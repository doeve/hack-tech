import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

/**
 * Fetches an SVG floor plan, detects if it's a simple line drawing,
 * post-processes it with styling, and extracts wall segments for pathfinding.
 *
 * Returns the (possibly styled) URL. Walls are stored in the zustand store.
 */
export function useStylizedSvg(url) {
  const [styledUrl, setStyledUrl] = useState(url)
  const prevUrl = useRef(null)

  useEffect(() => {
    if (!url || url === prevUrl.current) return
    prevUrl.current = url

    const process = async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) { setStyledUrl(url); return }
        const text = await res.text()

        // Detect "simple line" SVGs: mainly strokes, few/no fills
        const isSimpleLine = !text.includes('<style') &&
          !text.includes('fill-opacity') &&
          (text.match(/<path[\s>]/g) || []).length > 0

        // Parse walls from any SVG with paths — store in normalized 0..1 coords
        // (y-flipped to match map coordinate system). Converted to map metres at use time.
        const { walls, svgW, svgH } = parseSvgWalls(text)
        // Store SVG dimensions so FloorMap can compute aspect-correct bounds
        useStore.getState().setFloorSvgDims({ w: svgW, h: svgH })
        if (walls.length > 0) {
          const normWalls = walls.map((seg) => ({
            x1: seg.x1 / svgW,
            y1: 1 - seg.y1 / svgH,
            x2: seg.x2 / svgW,
            y2: 1 - seg.y2 / svgH,
          }))
          useStore.getState().setFloorWalls(normWalls)
        }

        if (!isSimpleLine) {
          // Convert to data URL for reliable loading
          const fixDoc = new DOMParser().parseFromString(text, 'image/svg+xml')
          const fixedUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(fixDoc))
          setStyledUrl(fixedUrl)
          return
        }

        const styled = stylizeSvg(text)
        // Use data URL — reliable, no lifecycle/revoke issues
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(styled)
        setStyledUrl(dataUrl)
      } catch (e) {
        console.warn('useStylizedSvg: failed to process SVG', e)
        setStyledUrl(url)
      }
    }

    process()
  }, [url])

  return styledUrl
}

// ── Parse SVG paths into wall line segments (SVG coordinates) ────
function parseSvgWalls(svgText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement

  // Check for parse errors
  if (svg.querySelector('parsererror')) return { walls: [], svgW: 800, svgH: 800 }

  const vb = svg.getAttribute('viewBox')
  let svgW = 800, svgH = 800
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number)
    svgW = parts[2] || 800
    svgH = parts[3] || 800
  }

  const walls = []
  const paths = svg.querySelectorAll('path')

  for (const path of paths) {
    const d = path.getAttribute('d')
    if (!d) continue
    const segments = parseDAttribute(d)
    walls.push(...segments)
  }

  // Also pick up any <line> elements
  const lines = svg.querySelectorAll('line')
  for (const line of lines) {
    walls.push({
      x1: parseFloat(line.getAttribute('x1') || 0),
      y1: parseFloat(line.getAttribute('y1') || 0),
      x2: parseFloat(line.getAttribute('x2') || 0),
      y2: parseFloat(line.getAttribute('y2') || 0),
    })
  }

  // Pick up <rect> elements (4 edges each)
  const rects = svg.querySelectorAll('rect')
  for (const rect of rects) {
    const rx = parseFloat(rect.getAttribute('x') || 0)
    const ry = parseFloat(rect.getAttribute('y') || 0)
    const rw = parseFloat(rect.getAttribute('width') || 0)
    const rh = parseFloat(rect.getAttribute('height') || 0)
    if (rw > 0 && rh > 0) {
      walls.push({ x1: rx, y1: ry, x2: rx + rw, y2: ry })
      walls.push({ x1: rx + rw, y1: ry, x2: rx + rw, y2: ry + rh })
      walls.push({ x1: rx + rw, y1: ry + rh, x2: rx, y2: ry + rh })
      walls.push({ x1: rx, y1: ry + rh, x2: rx, y2: ry })
    }
  }

  // Pick up <polyline> and <polygon> elements
  for (const tag of ['polyline', 'polygon']) {
    const elems = svg.querySelectorAll(tag)
    for (const el of elems) {
      const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number)
      for (let i = 0; i + 3 < pts.length; i += 2) {
        walls.push({ x1: pts[i], y1: pts[i + 1], x2: pts[i + 2], y2: pts[i + 3] })
      }
      // Close polygon
      if (tag === 'polygon' && pts.length >= 4) {
        walls.push({ x1: pts[pts.length - 2], y1: pts[pts.length - 1], x2: pts[0], y2: pts[1] })
      }
    }
  }

  return { walls, svgW, svgH }
}

// Parse an SVG path `d` attribute into line segments
// Handles M, L, Z commands (absolute) — sufficient for architectural floor plans
function parseDAttribute(d) {
  const segments = []
  // Tokenize: split on commands, keeping the command letter
  const tokens = d.match(/[MLZHVCSQTAmlzhvcsqta][^MLZHVCSQTAmlzhvcsqta]*/g)
  if (!tokens) return segments

  let cx = 0, cy = 0 // current point
  let mx = 0, my = 0 // last moveto (for Z)

  for (const token of tokens) {
    const cmd = token[0]
    const nums = (token.slice(1).match(/-?[\d.]+/g) || []).map(Number)

    switch (cmd) {
      case 'M':
        // moveto — start a new sub-path
        if (nums.length >= 2) {
          cx = nums[0]; cy = nums[1]
          mx = cx; my = cy
          // M can have implicit L commands after the first pair
          for (let i = 2; i + 1 < nums.length; i += 2) {
            const nx = nums[i], ny = nums[i + 1]
            segments.push({ x1: cx, y1: cy, x2: nx, y2: ny })
            cx = nx; cy = ny
          }
        }
        break
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const nx = nums[i], ny = nums[i + 1]
          segments.push({ x1: cx, y1: cy, x2: nx, y2: ny })
          cx = nx; cy = ny
        }
        break
      case 'H':
        for (const nx of nums) {
          segments.push({ x1: cx, y1: cy, x2: nx, y2: cy })
          cx = nx
        }
        break
      case 'V':
        for (const ny of nums) {
          segments.push({ x1: cx, y1: cy, x2: cx, y2: ny })
          cy = ny
        }
        break
      case 'Z':
      case 'z':
        if (cx !== mx || cy !== my) {
          segments.push({ x1: cx, y1: cy, x2: mx, y2: my })
        }
        cx = mx; cy = my
        break
      // Relative commands
      case 'm':
        if (nums.length >= 2) {
          cx += nums[0]; cy += nums[1]
          mx = cx; my = cy
          for (let i = 2; i + 1 < nums.length; i += 2) {
            const nx = cx + nums[i], ny = cy + nums[i + 1]
            segments.push({ x1: cx, y1: cy, x2: nx, y2: ny })
            cx = nx; cy = ny
          }
        }
        break
      case 'l':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const nx = cx + nums[i], ny = cy + nums[i + 1]
          segments.push({ x1: cx, y1: cy, x2: nx, y2: ny })
          cx = nx; cy = ny
        }
        break
      case 'h':
        for (const dx of nums) {
          segments.push({ x1: cx, y1: cy, x2: cx + dx, y2: cy })
          cx += dx
        }
        break
      case 'v':
        for (const dy of nums) {
          segments.push({ x1: cx, y1: cy, x2: cx, y2: cy + dy })
          cy += dy
        }
        break
      // For curves — approximate as a straight line to endpoint
      case 'C':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const nx = nums[i + 4], ny = nums[i + 5]
          segments.push({ x1: cx, y1: cy, x2: nx, y2: ny })
          cx = nx; cy = ny
        }
        break
      case 'c':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const nx = cx + nums[i + 4], ny = cy + nums[i + 5]
          segments.push({ x1: cx, y1: cy, x2: nx, y2: ny })
          cx = nx; cy = ny
        }
        break
      default:
        break
    }
  }

  return segments
}

// ── Stylize SVG for dark-theme display ───────────────────────────
function stylizeSvg(raw) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'image/svg+xml')
  const svg = doc.documentElement

  if (svg.querySelector('parsererror')) return raw

  const vb = svg.getAttribute('viewBox')
  let vbW = 800, vbH = 800
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number)
    vbW = parts[2] || 800
    vbH = parts[3] || 800
  }

  // Inject defs
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.prepend(defs)
  }

  const gridSize = Math.round(vbW / 16)
  defs.innerHTML = `
    <filter id="wallGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="0 0 0 0 0.23
                0 0 0 0 0.51
                0 0 0 0 0.96
                0 0 0 0.7 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <radialGradient id="floorGrad" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#0f2744"/>
      <stop offset="100%" stop-color="#060c18"/>
    </radialGradient>
    <pattern id="fpGrid" width="${gridSize}" height="${gridSize}" patternUnits="userSpaceOnUse">
      <path d="M ${gridSize} 0 L 0 0 0 ${gridSize}" fill="none" stroke="#1e3a5f" stroke-width="0.5" opacity="0.35"/>
    </pattern>
  `

  // Build new SVG content from scratch for reliability
  const ns = 'http://www.w3.org/2000/svg'

  // Background
  const bg = doc.createElementNS(ns, 'rect')
  bg.setAttribute('width', vbW)
  bg.setAttribute('height', vbH)
  bg.setAttribute('fill', 'url(#floorGrad)')

  const grid = doc.createElementNS(ns, 'rect')
  grid.setAttribute('width', vbW)
  grid.setAttribute('height', vbH)
  grid.setAttribute('fill', 'url(#fpGrid)')

  // Find the main geometry group
  const mainGroup = svg.querySelector('g') || svg

  // Clone geometry for shadow layer (wider, faint)
  const shadow = mainGroup.cloneNode(true)
  shadow.setAttribute('stroke', '#60a5fa')
  shadow.setAttribute('stroke-width', '12')
  shadow.setAttribute('stroke-opacity', '0.12')
  shadow.setAttribute('stroke-linecap', 'round')
  shadow.setAttribute('stroke-linejoin', 'round')
  shadow.removeAttribute('filter')
  shadow.querySelectorAll('path, line, polyline').forEach((el) => {
    el.removeAttribute('stroke')
    el.removeAttribute('stroke-width')
    el.removeAttribute('stroke-opacity')
  })

  // Style the main group
  mainGroup.setAttribute('stroke', '#3b82f6')
  mainGroup.setAttribute('stroke-width', '3')
  mainGroup.setAttribute('stroke-opacity', '0.9')
  mainGroup.setAttribute('stroke-linecap', 'round')
  mainGroup.setAttribute('stroke-linejoin', 'round')
  mainGroup.setAttribute('filter', 'url(#wallGlow)')
  // Clear per-element strokes so group style inherits cleanly
  mainGroup.querySelectorAll('path, line, polyline').forEach((el) => {
    el.removeAttribute('stroke')
    el.removeAttribute('stroke-width')
    el.removeAttribute('stroke-opacity')
    el.removeAttribute('stroke-linecap')
    el.removeAttribute('stroke-linejoin')
  })

  // Assemble: defs, bg, grid, shadow, main
  // Remove all children except defs
  const children = [...svg.childNodes]
  for (const ch of children) {
    if (ch !== defs) svg.removeChild(ch)
  }
  svg.appendChild(bg)
  svg.appendChild(grid)
  svg.appendChild(shadow)
  svg.appendChild(mainGroup)

  // Fix dimensions (aspect ratio preserved by ImageOverlay bounds matching SVG ratio)
  svg.setAttribute('width', String(vbW))
  svg.setAttribute('height', String(vbH))

  return new XMLSerializer().serializeToString(doc)
}
