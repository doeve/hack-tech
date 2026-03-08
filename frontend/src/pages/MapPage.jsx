import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useStore } from '../store'
import {
  getAirports, getAirportPOIs, getNavGraph, getRoute,
  createSession, getMyFlights,
} from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'
import { useIMU } from '../hooks/useIMU'
import { useHapticController } from '../components/Accessibility/HapticController'
import { useTTS } from '../components/Accessibility/TTSController'
import FloorMap from '../components/Map/FloorMap'
import InstructionBanner from '../components/Navigation/InstructionBanner'
import FlightCTABanner from '../components/Navigation/FlightCTABanner'
import JourneyProgress from '../components/Navigation/JourneyProgress'
import BottomNav from '../components/BottomNav'

// ── Line-segment intersection test (handles collinear overlap) ───
function segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const dx1 = ax2 - ax1, dy1 = ay2 - ay1
  const dx2 = bx2 - bx1, dy2 = by2 - by1
  const denom = dx1 * dy2 - dy1 * dx2

  if (Math.abs(denom) < 1e-10) {
    // Parallel — check if collinear and overlapping
    const cross = (bx1 - ax1) * dy1 - (by1 - ay1) * dx1
    if (Math.abs(cross) > 0.5) return false // parallel but not collinear (0.5m tolerance)
    // Collinear — project B onto A's axis and check overlap
    const lenSq = dx1 * dx1 + dy1 * dy1
    if (lenSq < 1e-10) return false // degenerate segment
    const t1 = ((bx1 - ax1) * dx1 + (by1 - ay1) * dy1) / lenSq
    const t2 = ((bx2 - ax1) * dx1 + (by2 - ay1) * dy1) / lenSq
    const tMin = Math.min(t1, t2), tMax = Math.max(t1, t2)
    // Overlap if [0,1] and [tMin,tMax] intersect
    return tMax > 0.01 && tMin < 0.99
  }

  const t = ((bx1 - ax1) * dy2 - (by1 - ay1) * dx2) / denom
  const u = ((bx1 - ax1) * dy1 - (by1 - ay1) * dx1) / denom
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999
}

// Check if a straight line between two points crosses any wall
function crossesWall(ax, ay, bx, by, walls) {
  for (const w of walls) {
    if (segmentsIntersect(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) return true
  }
  return false
}

// ── Binary min-heap for A* priority queue ────────────────────────
class MinHeap {
  constructor() { this.d = [] }
  push(v) { this.d.push(v); this._up(this.d.length - 1) }
  pop() {
    const top = this.d[0], last = this.d.pop()
    if (this.d.length > 0) { this.d[0] = last; this._down(0) }
    return top
  }
  get size() { return this.d.length }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.d[p].f <= this.d[i].f) break
      ;[this.d[p], this.d[i]] = [this.d[i], this.d[p]]
      i = p
    }
  }
  _down(i) {
    const n = this.d.length
    while (true) {
      let s = i, l = 2 * i + 1, r = 2 * i + 2
      if (l < n && this.d[l].f < this.d[s].f) s = l
      if (r < n && this.d[r].f < this.d[s].f) s = r
      if (s === i) break
      ;[this.d[s], this.d[i]] = [this.d[i], this.d[s]]
      i = s
    }
  }
}

// Compute image bounds that preserve SVG aspect ratio, fitted within airport bounds
function computeFloorBounds(airport, svgDims) {
  const W = airport.width_m, H = airport.height_m
  if (!svgDims) return { x0: 0, y0: 0, w: W, h: H }
  const svgAspect = svgDims.w / svgDims.h
  const mapAspect = W / H
  if (svgAspect >= mapAspect) {
    const imgH = W / svgAspect
    return { x0: 0, y0: (H - imgH) / 2, w: W, h: imgH }
  }
  const imgW = H * svgAspect
  return { x0: (W - imgW) / 2, y0: 0, w: imgW, h: H }
}

// ── Journey planner: order mandatory POIs for departure ──────────
function planJourney(flight, position, pois) {
  const plan = []
  const nearest = (pos, list) => {
    let best = list[0], bestDist = Infinity
    for (const p of list) {
      const dx = (p.x_m || 0) - pos.x_m, dy = (p.y_m || 0) - pos.y_m
      const d = dx * dx + dy * dy
      if (d < bestDist) { bestDist = d; best = p }
    }
    return best
  }

  // Check-in
  const checkins = pois.filter((p) => p.category === 'checkin')
  if (checkins.length) plan.push(nearest(position, checkins))

  // Security
  const securities = pois.filter((p) => p.category === 'security')
  if (securities.length) plan.push(nearest(position, securities))

  // Passport control (optional)
  const passports = pois.filter((p) => p.category === 'passport')
  if (passports.length) plan.push(nearest(position, passports))

  // Gate — match by gate_poi_id or gate number
  const gatePoi = pois.find((p) => (p.poi_id || p.id) === flight.gate_poi_id)
    || pois.find((p) => p.category === 'gate' && p.gate_number === flight.gate)
  if (gatePoi) plan.push(gatePoi)

  return plan
}

// ── Grid-based A* pathfinding (wall-aware) ───────────────────────
function clientAStar(fromPos, toPoi, pois, airport, walls) {
  if (!airport) return null
  const W = airport.width_m, H = airport.height_m
  const destX = toPoi.x_m, destY = toPoi.y_m

  // Convert normalized walls (0..1) to map coordinates using fitted image bounds
  const svgDims = useStore.getState().floorSvgDims
  const fb = computeFloorBounds(airport, svgDims)
  const mapWalls = (walls || []).map((w) => ({
    x1: fb.x0 + w.x1 * fb.w, y1: fb.y0 + w.y1 * fb.h,
    x2: fb.x0 + w.x2 * fb.w, y2: fb.y0 + w.y2 * fb.h,
  }))

  // No walls — direct line
  if (mapWalls.length === 0) {
    const dist = Math.sqrt((destX - fromPos.x_m) ** 2 + (destY - fromPos.y_m) ** 2)
    const coords = [
      { id: '__start__', x_m: fromPos.x_m, y_m: fromPos.y_m },
      { id: toPoi.poi_id || toPoi.id, x_m: destX, y_m: destY, name: toPoi.name },
    ]
    return {
      node_sequence: coords.map((c) => c.id), edge_sequence: [],
      total_distance_m: Math.round(dist), total_time_s: Math.round(dist / 1.4),
      instructions: [{ step_index: 0, instruction_type: 'continue_straight', distance_m: Math.round(dist), display_text: `Head to ${toPoi.name} (${Math.round(dist)}m)`, tts_text: `Head straight for ${Math.round(dist)} metres`, haptic_cue: 'continue_straight' }],
      _coords: coords,
    }
  }

  // Grid resolution: ~80 cells on longer axis (small enough to fit through doors)
  const maxDim = Math.max(W, H)
  const STEP = maxDim / 80
  const cols = Math.ceil(W / STEP)
  const rows = Math.ceil(H / STEP)
  // Offset grid origin by a fractional step to avoid collinear alignment with walls
  const OX = STEP * 0.37, OY = STEP * 0.41

  const toCol = (x) => Math.min(Math.max(Math.round((x - OX) / STEP), 0), cols)
  const toRow = (y) => Math.min(Math.max(Math.round((y - OY) / STEP), 0), rows)
  const toWorld = (c, r) => [c * STEP + OX, r * STEP + OY]
  const key = (c, r) => c * 10000 + r // fast numeric key (works up to 10000 rows)

  const sc = toCol(fromPos.x_m), sr = toRow(fromPos.y_m)
  const dc = toCol(destX), dr = toRow(destY)

  // 8-directional neighbors
  const dirs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]
  const DIAG = STEP * 1.414

  // Heuristic: octile distance
  const heuristic = (c, r) => {
    const dx = Math.abs(c - dc) * STEP
    const dy = Math.abs(r - dr) * STEP
    const mn = Math.min(dx, dy), mx = Math.max(dx, dy)
    return mn * 1.414 + (mx - mn)
  }

  // A* on grid with binary heap
  const open = new MinHeap()
  open.push({ f: heuristic(sc, sr), g: 0, c: sc, r: sr })
  const gScore = new Map()
  gScore.set(key(sc, sr), 0)
  const cameFrom = new Map()
  const closed = new Set()

  while (open.size > 0) {
    const { c, r, g } = open.pop()
    const k = key(c, r)

    if (closed.has(k)) continue
    closed.add(k)

    if (c === dc && r === dr) {
      // Reconstruct grid path
      const gridPath = [[dc, dr]]
      let cur = key(dc, dr)
      while (cameFrom.has(cur)) {
        cur = cameFrom.get(cur)
        const gc = (cur / 10000) | 0, gr = cur % 10000
        gridPath.unshift([gc, gr])
      }

      // Convert to world coordinates
      const worldPath = gridPath.map(([gc, gr]) => toWorld(gc, gr))

      // Simplify: keep only turning points (where direction changes).
      // This is safe because the grid path already respects walls.
      const smoothed = [worldPath[0]]
      for (let i = 1; i < worldPath.length - 1; i++) {
        const [px, py] = worldPath[i - 1]
        const [cx, cy] = worldPath[i]
        const [nx, ny] = worldPath[i + 1]
        const dx1 = cx - px, dy1 = cy - py
        const dx2 = nx - cx, dy2 = ny - cy
        // Keep point if direction changes (cross product != 0)
        if (Math.abs(dx1 * dy2 - dy1 * dx2) > 0.01) {
          smoothed.push(worldPath[i])
        }
      }
      smoothed.push(worldPath[worldPath.length - 1])

      // Build route result
      const coords = smoothed.map(([x, y], idx) => ({ id: `step_${idx}`, x_m: x, y_m: y }))
      // Replace first/last with exact positions
      coords[0] = { id: '__start__', x_m: fromPos.x_m, y_m: fromPos.y_m }
      coords[coords.length - 1] = { id: toPoi.poi_id || toPoi.id, x_m: destX, y_m: destY, name: toPoi.name }

      let totalDist = 0
      for (let j = 1; j < coords.length; j++) {
        totalDist += Math.sqrt((coords[j].x_m - coords[j - 1].x_m) ** 2 + (coords[j].y_m - coords[j - 1].y_m) ** 2)
      }

      const instructions = []
      for (let j = 0; j < coords.length - 1; j++) {
        const from = coords[j], to = coords[j + 1]
        const segDist = Math.sqrt((to.x_m - from.x_m) ** 2 + (to.y_m - from.y_m) ** 2)
        const via = to.name ? `towards ${to.name}` : 'ahead'
        instructions.push({
          step_index: j,
          instruction_type: 'continue_straight',
          distance_m: Math.round(segDist),
          display_text: j === 0 ? `Head ${via} for ${Math.round(segDist)}m` : `Continue ${via} for ${Math.round(segDist)}m`,
          tts_text: `Continue for ${Math.round(segDist)} metres`,
          haptic_cue: 'continue_straight',
        })
      }

      return {
        node_sequence: coords.map((c) => c.id), edge_sequence: [],
        total_distance_m: Math.round(totalDist), total_time_s: Math.round(totalDist / 1.4),
        instructions, _coords: coords,
      }
    }

    // Expand neighbors
    for (const [dc2, dr2] of dirs) {
      const nc = c + dc2, nr = r + dr2
      if (nc < 0 || nc > cols || nr < 0 || nr > rows) continue
      const nk = key(nc, nr)
      if (closed.has(nk)) continue

      // Check wall crossing for this grid edge
      const [x1, y1] = toWorld(c, r)
      const [x2, y2] = toWorld(nc, nr)
      if (crossesWall(x1, y1, x2, y2, mapWalls)) continue

      const moveCost = (dc2 !== 0 && dr2 !== 0) ? DIAG : STEP
      const tentG = g + moveCost
      if (tentG < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, tentG)
        cameFrom.set(nk, k)
        open.push({ f: tentG + heuristic(nc, nr), g: tentG, c: nc, r: nr })
      }
    }
  }

  // No path found — return null (never draw through walls)
  return null
}

// ── Parse position QR helper ──────────────────────────────────────
function parsePositionQR(text) {
  try {
    const data = JSON.parse(text)
    if (data.type === 'skyguide_position' && data.x_m != null && data.y_m != null) return data
  } catch {}
  return null
}

// ── QR Scanner Modal for position scanning ───────────────────────
function PositionQRScanner({ onScanned, onClose }) {
  const readerRef = useRef(null)
  const [error, setError] = useState(null)
  const [pastedImg, setPastedImg] = useState(null)
  const onScanRef = useRef(onScanned)
  onScanRef.current = onScanned

  // Camera scanner
  useEffect(() => {
    let active = true
    const container = readerRef.current
    if (!container) return
    const scannerId = 'pos-qr-reader-' + Date.now()
    container.id = scannerId
    container.innerHTML = ''
    const scanner = new Html5Qrcode(scannerId)

    const timer = setTimeout(() => {
      if (!active) return
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          if (!active) return
          const data = parsePositionQR(text)
          if (data) {
            active = false
            try { scanner.stop() } catch {}
            onScanRef.current(data)
          }
        },
        () => {}
      ).catch(() => { if (active) setError('Camera access denied') })
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
      try { scanner.stop() } catch {}
      container.innerHTML = ''
    }
  }, [])

  // Clipboard paste support
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          const url = URL.createObjectURL(file)
          setPastedImg(url)
          setTimeout(async () => {
            try {
              const tmpId = 'pos-paste-' + Date.now()
              const div = document.createElement('div')
              div.id = tmpId
              div.style.display = 'none'
              document.body.appendChild(div)
              const tmp = new Html5Qrcode(tmpId)
              const result = await tmp.scanFileV2(file, false)
              document.body.removeChild(div)
              const data = parsePositionQR(result.decodedText)
              if (data) {
                onScanRef.current(data)
              } else {
                setError('No position QR found in image')
                setPastedImg(null)
              }
            } catch {
              setError('Could not read QR from pasted image')
              setPastedImg(null)
            }
          }, 300)
          return
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-2xl w-full max-w-sm mx-4 p-4 text-center">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-white z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-white mb-3">Scan Position QR Code</p>
        {pastedImg ? (
          <div className="rounded-xl overflow-hidden" style={{ minHeight: 280 }}>
            <img src={pastedImg} className="w-full h-full object-contain" alt="Pasted QR" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
            </div>
          </div>
        ) : (
          <div ref={readerRef} className="rounded-xl overflow-hidden" style={{ minHeight: 280 }} />
        )}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    </div>
  )
}

// ── Position Selection Modal ─────────────────────────────────────
// Works in two contexts:
//  1. Initial entry (no destPoi) — "Where are you?"
//  2. Before navigation (with destPoi) — "Where are you? We'll navigate to X"
function PositionModal({ onSetPosition, onClose, onSelectMap, destPoi }) {
  const [mode, setMode] = useState(null) // null | 'scan'

  if (mode === 'scan') {
    return (
      <PositionQRScanner
        onScanned={(data) => onSetPosition(data.x_m, data.y_m, 'qr_scan')}
        onClose={() => setMode(null)}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center pb-28">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-2xl w-full max-w-sm mx-4 p-5 border border-slate-700/50 shadow-2xl">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="text-white font-bold text-base mb-1">Where are you?</p>
        <p className="text-slate-400 text-xs mb-5">
          {destPoi
            ? <>Set your position to navigate to <span className="text-blue-400 font-medium">{destPoi.name}</span>.</>
            : 'Scan a nearby position QR code or mark your location on the map.'}
        </p>

        <div className="space-y-2.5">
          <button
            onClick={() => setMode('scan')}
            className="w-full flex items-center gap-3 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 rounded-xl px-4 py-3 transition-colors"
          >
            <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-medium">Scan Position QR</p>
              <p className="text-slate-500 text-[11px]">Scan a nearby position marker QR code</p>
            </div>
          </button>

          <button
            onClick={onSelectMap}
            className="w-full flex items-center gap-3 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 rounded-xl px-4 py-3 transition-colors"
          >
            <div className="w-9 h-9 bg-slate-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-medium">Place on Map</p>
              <p className="text-slate-500 text-[11px]">Tap the floor plan to mark your location</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Long-press hook ──────────────────────────────────────────────
function useLongPress(onLongPress, onClick, ms = 500) {
  const timerRef = useRef(null)
  const pressedRef = useRef(false)

  const start = useCallback(() => {
    pressedRef.current = false
    timerRef.current = setTimeout(() => {
      pressedRef.current = true
      onLongPress()
    }, ms)
  }, [onLongPress, ms])

  const end = useCallback(() => {
    clearTimeout(timerRef.current)
    if (!pressedRef.current) onClick()
  }, [onClick])

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
  }, [])

  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: cancel,
  }
}

export default function MapPage() {
  const {
    airport, setAirport, setPois, setNavGraph,
    navGraph, pois, session, setSession,
    position, setPosition, setRoute, route,
    accessProfile, positionConfirmed, setPositionConfirmed,
  } = useStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const { confirmPosition } = useWebSocket(session?.id)

  // Accessibility hooks
  const { vibrateForInstruction, vibrateForEvent } = useHapticController()
  const { announceInstruction, announceWaypointArrival, announceJourneyComplete } = useTTS()

  // Navigation flow state
  const [pendingDest, setPendingDest] = useState(null)
  const [positionMode, setPositionMode] = useState(null) // 'modal' | null
  const [settingPosition, setSettingPosition] = useState(false) // map tap mode
  const [zoomTrigger, setZoomTrigger] = useState(0)
  const [zoomDelta, setZoomDelta] = useState(0) // +1 or -1 to zoom in/out
  const mapRef = useRef(null)

  // Journey state
  const { journeyPlan, journeyStepIndex, journeyFlight, setJourneyPlan, advanceJourneyStep, clearJourney } = useStore()
  const [myFlights, setMyFlights] = useState([])
  const journeyArrivalRef = useRef(false)

  // ── Accessibility: announce navigation instructions on step change ──
  const prevStepRef = useRef(-1)
  const currentStepIndex = useStore((s) => s.currentStepIndex)
  useEffect(() => {
    if (!route?.instructions) return
    if (currentStepIndex === prevStepRef.current) return
    prevStepRef.current = currentStepIndex
    const instruction = route.instructions[currentStepIndex]
    if (!instruction) return
    announceInstruction(instruction)
    vibrateForInstruction(instruction.haptic_cue || instruction.instruction_type || 'continue_straight')
  }, [currentStepIndex, route, announceInstruction, vibrateForInstruction])

  // Set default position to bottom-center of the SVG floor plan
  const floorSvgDims = useStore((s) => s.floorSvgDims)
  const floorWalls = useStore((s) => s.floorWalls)
  const defaultPosSetRef = useRef(false)
  useEffect(() => {
    if (defaultPosSetRef.current) return
    const ap = useStore.getState().airport
    const dims = useStore.getState().floorSvgDims
    const walls = useStore.getState().floorWalls
    if (!ap || !dims || !walls?.length) return
    defaultPosSetRef.current = true
    const fb = computeFloorBounds(ap, dims)

    // Find the bottommost wall (lowest y in map coords) to place dot just inside
    let minWallY = Infinity
    for (const w of walls) {
      const wy1 = fb.y0 + w.y1 * fb.h
      const wy2 = fb.y0 + w.y2 * fb.h
      if (wy1 < minWallY) minWallY = wy1
      if (wy2 < minWallY) minWallY = wy2
    }

    const defaultX = fb.x0 + fb.w / 2
    const defaultY = minWallY + 5 // 5m inside from the bottommost wall
    useStore.getState().setPosition({
      x_m: defaultX,
      y_m: defaultY,
      heading_deg: 0,
      drift_radius_m: 0,
      source: 'default',
    })
    useStore.getState().setPositionConfirmed(true)
  }, [airport, floorSvgDims, floorWalls])

  // IMU for real-time heading + step-based dead reckoning
  const { heading, stepCount, permissionGranted, requestPermission, setOnStep } = useIMU()
  const stepAccumRef = useRef(0) // tracks drift growth

  // Register step callback for dead reckoning
  useEffect(() => {
    setOnStep((headingDeg, stepLengthM) => {
      if (!useStore.getState().positionConfirmed) return
      const pos = useStore.getState().position
      const ap = useStore.getState().airport

      // Convert compass heading to displacement
      // heading 0°=north=+y, 90°=east=+x
      const rad = (headingDeg * Math.PI) / 180
      let newX = pos.x_m + stepLengthM * Math.sin(rad)
      let newY = pos.y_m + stepLengthM * Math.cos(rad)

      // Clamp within map bounds
      if (ap) {
        newX = Math.max(1, Math.min(ap.width_m - 1, newX))
        newY = Math.max(1, Math.min(ap.height_m - 1, newY))
      }

      // Grow drift radius with each step (uncertainty increases)
      stepAccumRef.current += 1
      const drift = Math.min(stepAccumRef.current * 0.3, 15) // caps at 15m

      useStore.getState().setPosition({
        x_m: newX,
        y_m: newY,
        heading_deg: headingDeg,
        drift_radius_m: drift,
        source: 'dead_reckoning',
      })
    })
  }, [setOnStep])

  // Heading is now updated directly in BlueDot via IMU deviceorientation listener.
  // No need to funnel heading through the store at an interval.

  // Request IMU permission early (no modal on entry — only when navigating)
  useEffect(() => {
    if (!loading) requestPermission()
  }, [loading, requestPermission])

  useEffect(() => {
    const loadAirport = async () => {
      try {
        const { data: airports } = await getAirports()
        if (!airports?.length) { setError('No airports found'); setLoading(false); return }
        const ap = airports[0]
        setAirport(ap)
        const [poisRes, graphRes] = await Promise.all([
          getAirportPOIs(ap.id),
          getNavGraph(ap.id),
        ])
        setPois(poisRes.data)
        setNavGraph(graphRes.data)
        setLoading(false)
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load airport data')
        setLoading(false)
      }
    }
    loadAirport()
  }, [setAirport, setPois, setNavGraph])

  // Fetch user's flights for CTA banner
  useEffect(() => {
    const load = () => getMyFlights()
      .then(({ data }) => setMyFlights(data || []))
      .catch(() => {})
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Find approaching departure flight (within 2 hours)
  const approachingFlight = useMemo(() => {
    const now = Date.now()
    return myFlights
      .filter((f) => {
        if (f.direction && f.direction !== 'departure') return false
        const dep = new Date(f.estimated_at || f.scheduled_at).getTime()
        return dep > now && dep - now <= 2 * 60 * 60 * 1000
      })
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null
  }, [myFlights])

  // Begin journey handler
  const handleBeginJourney = useCallback((flight) => {
    const pos = useStore.getState().position
    const plan = planJourney(flight, pos, pois)
    if (!plan.length) return
    setJourneyPlan(plan, flight)
    // Start navigating to first waypoint
    const firstPoi = plan[0]
    startNavigation(pos, firstPoi.poi_id || firstPoi.id)
  }, [pois, setJourneyPlan, startNavigation])

  // Arrival detection for journey mode
  useEffect(() => {
    if (!journeyPlan || !route) return
    const currentDest = journeyPlan[journeyStepIndex]
    if (!currentDest) return

    const pos = useStore.getState().position
    const dx = pos.x_m - (currentDest.x_m || 0)
    const dy = pos.y_m - (currentDest.y_m || 0)
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 8 && !journeyArrivalRef.current) {
      journeyArrivalRef.current = true
      vibrateForEvent('waypoint_arrival')
      const nextIndex = journeyStepIndex + 1
      if (nextIndex < journeyPlan.length) {
        const nextPoi = journeyPlan[nextIndex]
        announceWaypointArrival(currentDest.name || 'checkpoint', nextPoi.name)
        // Advance to next step after brief pause
        setTimeout(() => {
          advanceJourneyStep()
          setRoute(null)
          const currentPos = useStore.getState().position
          startNavigation(currentPos, nextPoi.poi_id || nextPoi.id)
          journeyArrivalRef.current = false
        }, 2500)
      } else {
        // Journey complete!
        vibrateForEvent('journey_complete')
        announceJourneyComplete(currentDest.name || currentDest.gate_number)
        setTimeout(() => {
          setRoute(null)
          clearJourney()
          journeyArrivalRef.current = false
        }, 1000)
      }
    }
  }, [position, journeyPlan, journeyStepIndex, route, advanceJourneyStep, clearJourney, setRoute, startNavigation, vibrateForEvent, announceWaypointArrival, announceJourneyComplete])

  // Start navigation after position is confirmed
  const startNavigation = useCallback(async (fromPos, destPoiId) => {
    if (!airport) return
    const walls = useStore.getState().floorWalls
    const destPoi = pois.find((p) => (p.poi_id || p.id) === destPoiId)
    if (!destPoi) return

    // Always use wall-aware client-side A* when walls are available.
    // The server nav graph doesn't know about walls, so its routes can cross them.
    if (walls?.length > 0) {
      const result = clientAStar(fromPos, destPoi, pois, airport, walls)
      if (result) {
        setRoute(result)
        // Try to create a session in the background
        try {
          const { data: sess } = await createSession({
            airport_id: airport.id,
            start_x_m: fromPos.x_m, start_y_m: fromPos.y_m,
            start_confirmed_by: fromPos.source || 'manual_set',
            destination_poi_id: destPoiId,
            route_mode: accessProfile.avoid_stairs ? 'accessible' : 'fastest',
            nav_mode: accessProfile.nav_mode || 'standard',
            ar_enabled: accessProfile.ar_enabled,
          })
          setSession(sess)
        } catch {}
        return
      }
      // clientAStar returned null (no path) — fall through to server route
    }

    // Fallback: server-side nav graph route (no wall awareness)
    const hasNavGraph = navGraph?.nodes?.length > 0 && navGraph?.edges?.length > 0
    if (hasNavGraph) {
      const destNode = navGraph.nodes.find((n) => n.poi_id === destPoiId)
      if (!destNode) return
      let closestNode = navGraph.nodes[0]
      let closestDist = Infinity
      for (const node of navGraph.nodes) {
        const dx = node.x_m - fromPos.x_m
        const dy = node.y_m - fromPos.y_m
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < closestDist) { closestDist = dist; closestNode = node }
      }
      try {
        const mode = accessProfile.avoid_stairs ? 'accessible' : 'fastest'
        const { data: routeData } = await getRoute({
          airport_id: airport.id,
          from_node_id: closestNode.id,
          to_node_id: destNode.id,
          mode,
        })
        setRoute(routeData)
      } catch (err) {
        console.error('Server route failed:', err)
      }
    }
  }, [airport, navGraph, pois, accessProfile, setRoute, setSession])

  // Navigate here on a POI — ask for position only if not yet confirmed this session
  const handleSelectDestination = useCallback((poiId) => {
    const destPoi = pois.find((p) => (p.poi_id || p.id) === poiId)
    if (!destPoi) return

    if (useStore.getState().positionConfirmed) {
      startNavigation(useStore.getState().position, poiId)
    } else {
      setPendingDest(destPoi)
      setPositionMode('modal')
    }
  }, [pois, startNavigation])

  // Position is set (from map click or QR scan)
  const handlePositionSet = useCallback((x_m, y_m, source = 'manual_set') => {
    const newPos = {
      x_m, y_m,
      heading_deg: heading || position.heading_deg,
      drift_radius_m: 0,
      source,
    }
    setPosition(newPos)
    setPositionConfirmed(true)
    stepAccumRef.current = 0 // reset drift on anchor
    confirmPosition(x_m, y_m)
    vibrateForEvent('confirm')
    setSettingPosition(false)
    setPositionMode(null)

    // Zoom to user after setting position
    setZoomTrigger((t) => t + 1)

    if (pendingDest) {
      startNavigation(newPos, pendingDest.poi_id || pendingDest.id)
      setPendingDest(null)
    }
  }, [heading, position, setPosition, setPositionConfirmed, confirmPosition, pendingDest, startNavigation])

  const handleMapClick = useCallback((x_m, y_m) => {
    if (settingPosition) {
      handlePositionSet(x_m, y_m, 'manual_set')
      return
    }
    // If position already confirmed, clicking the map doesn't reset it
    // (only the position modal or long-press nav button does that)
  }, [settingPosition, handlePositionSet])

  const filteredPois = pois?.filter((p) => {
    if (!searchQuery) return false
    const q = searchQuery.toLowerCase()
    return p.name?.toLowerCase().includes(q) ||
      p.gate_number?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
  }) || []

  const handlePoiSelect = (poi) => {
    setSearchQuery(poi.name)
    setSearchOpen(false)
    handleSelectDestination(poi.poi_id || poi.id)
  }

  const handleCancelNavigation = () => {
    setRoute(null)
    setPendingDest(null)
    setPositionMode(null)
    setSettingPosition(false)
    clearJourney()
  }

  // Navigation button: tap = zoom to user, hold = reopen position modal
  const navButtonHandlers = useLongPress(
    () => {
      // Long press: open position modal
      setPositionMode('modal')
    },
    () => {
      // Tap: zoom to user if position is known
      if (positionConfirmed) {
        setZoomTrigger((t) => t + 1)
      }
    },
    500
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0b1120]">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-blue-400
                          border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading airport...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0b1120] p-4">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-blue-400 text-sm hover:text-blue-300">Retry</button>
        </div>
      </div>
    )
  }

  const currentInstruction = route?.instructions?.[useStore.getState().currentStepIndex]
  const remainingMins = route ? Math.ceil(
    route.instructions?.slice(useStore.getState().currentStepIndex)
      .reduce((sum, i) => sum + (i.distance_m || 0), 0) / 1.2 / 60
  ) : null

  return (
    <div className="relative h-full w-full bg-[#0b1120]">
      {/* Map */}
      <FloorMap
        onMapClick={handleMapClick}
        onSelectDestination={handleSelectDestination}
        clientRoute={route?._coords}
        zoomToUserTrigger={zoomTrigger}
        mapRef={mapRef}
        zoomDelta={zoomDelta}
      />

      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-700/50 px-4 py-2.5">
          <svg className="w-4.5 h-4.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search Gates, Lounges, or..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && filteredPois.length > 0 && (
          <div className="mt-2 bg-slate-800/95 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
            {filteredPois.map((poi) => (
              <button
                key={poi.poi_id || poi.id}
                onClick={() => handlePoiSelect(poi)}
                className="w-full px-4 py-3 text-left hover:bg-slate-700/50 flex items-center gap-3 border-b border-slate-700/30 last:border-b-0"
              >
                <span className="text-[10px] uppercase tracking-wider text-slate-500 w-14">{poi.category}</span>
                <span className="text-sm text-white flex-1">{poi.name}</span>
                {poi.gate_number && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{poi.gate_number}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* "Setting position" banner when in map-tap mode */}
      {settingPosition && (
        <div className="absolute top-16 left-4 right-4 z-[1500]">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl border border-blue-500/30 px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">Set Your Position</p>
                <p className="text-slate-400 text-[11px] mt-0.5">Tap the map where you are right now</p>
              </div>
              <button onClick={() => { setSettingPosition(false); setPendingDest(null); setPositionMode(null) }}
                className="text-slate-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Position Selection Modal */}
      {positionMode === 'modal' && (
        <PositionModal
          destPoi={pendingDest}
          onSetPosition={(x, y, source) => handlePositionSet(x, y, source)}
          onClose={() => { setPositionMode(null); setPendingDest(null) }}
          onSelectMap={() => { setPositionMode(null); setSettingPosition(true) }}
        />
      )}

      {/* Zoom Controls + Navigation Button */}
      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={() => setZoomDelta((d) => d + 1)}
          className="w-9 h-9 bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-lg flex items-center justify-center text-white text-lg hover:bg-slate-700/80 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setZoomDelta((d) => d - 1)}
          className="w-9 h-9 bg-slate-800/80 backdrop-blur border border-slate-700/50 rounded-lg flex items-center justify-center text-white text-lg hover:bg-slate-700/80 transition-colors"
        >
          -
        </button>
        {/* Navigation button: tap = zoom to user, hold = reposition */}
        <button
          {...navButtonHandlers}
          className={`w-9 h-9 backdrop-blur border rounded-lg flex items-center justify-center transition-colors mt-1 select-none ${
            positionConfirmed
              ? 'bg-blue-600/80 border-blue-500/50 text-white shadow-lg shadow-blue-600/30'
              : 'bg-slate-800/80 border-slate-700/50 text-slate-400 hover:text-white'
          }`}
          title={positionConfirmed ? 'Tap: zoom to me | Hold: set position' : 'Set your position'}
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Journey Progress (above nav card) */}
      {journeyPlan && (
        <div className="absolute bottom-44 left-4 right-4 z-[1000]">
          <div className="bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-700/30 px-3 py-2.5 shadow-xl">
            <JourneyProgress plan={journeyPlan} currentIndex={journeyStepIndex} />
          </div>
        </div>
      )}

      {/* Next Step Card */}
      {route && currentInstruction && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000]">
          <div className="bg-slate-800/95 backdrop-blur-md rounded-2xl border border-slate-700/30 px-4 py-3 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">
                {journeyPlan
                  ? `Step ${journeyStepIndex + 1}/${journeyPlan.length} — ${journeyPlan[journeyStepIndex]?.name || 'Next'}`
                  : 'Next Step'}
              </p>
              <button onClick={handleCancelNavigation}
                className="text-[10px] text-red-400 hover:text-red-300 font-medium">
                End Nav
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {currentInstruction.display_text || currentInstruction.tts_text || 'Continue ahead'}
                </p>
              </div>
              {remainingMins != null && remainingMins > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-blue-400 text-xl font-bold leading-none">{remainingMins}</p>
                  <p className="text-blue-400 text-xs">mins</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Flight approaching CTA */}
      {approachingFlight && !route && !journeyPlan && !settingPosition && positionConfirmed && (
        <FlightCTABanner flight={approachingFlight} onConfirm={handleBeginJourney} />
      )}

      {/* Instruction Banner (fallback) */}
      {route && !currentInstruction && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000]">
          <InstructionBanner />
        </div>
      )}

      <BottomNav />
    </div>
  )
}
