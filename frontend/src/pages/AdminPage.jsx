import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, ImageOverlay, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../store'
import { getAirportPOIs, getAirports, getFlights } from '../api/client'
import api from '../api/client'

const TABS = ['Dashboard', 'Airport', 'Notify']

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Dashboard')
  const [worker, setWorker] = useState({ running: false, speed: 1, elapsed: 0 })
  const [flights, setFlights] = useState([])
  const [events, setEvents] = useState([])

  // Poll worker status + flights
  useEffect(() => {
    let id
    const poll = async () => {
      try {
        const [statusRes, flightsRes] = await Promise.all([
          api.get('/admin/sim/status'),
          getFlights({}),
        ])
        setWorker(statusRes.data)
        setFlights(flightsRes.data || [])
      } catch {}
    }
    poll()
    id = setInterval(poll, worker.running ? 2500 : 5000)
    return () => clearInterval(id)
  }, [worker.running])

  const stats = {
    total: flights.length,
    boarding: flights.filter((f) => f.status === 'boarding').length,
    delayed: flights.filter((f) => f.status === 'delayed').length,
    departed: flights.filter((f) => f.status === 'departed').length,
    scheduled: flights.filter((f) => f.status === 'scheduled').length,
    cancelled: flights.filter((f) => f.status === 'cancelled').length,
    final: flights.filter((f) => f.status === 'final_call').length,
  }

  const handleStart = () => api.post('/admin/sim/start').then((r) => setWorker(r.data))
  const handleStop = () => api.post('/admin/sim/stop').then((r) => setWorker(r.data))
  const handleSpeed = (s) => api.post('/admin/sim/speed', { speed: s }).then((r) => setWorker(r.data))
  const handleReset = async () => {
    await api.post('/admin/sim/reset')
    setWorker({ running: false, speed: 1, elapsed: 0 })
    setFlights([])
  }

  const formatTime = (dt) => {
    if (!dt) return '--:--'
    return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/map')} className="text-slate-500 hover:text-slate-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold tracking-wide">SkyGuide Mission Control</h1>
          <div className="w-5" />
        </div>
      </div>

      {/* Worker controls */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={worker.running ? handleStop : handleStart}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                worker.running
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
              }`}
            >
              {worker.running ? 'Stop' : 'Start'} Worker
            </button>

            <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeed(s)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    worker.speed === s ? 'bg-[#1e3a8a] text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            <button onClick={handleReset}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-white transition-colors">
              Reset
            </button>

            <div className="flex-1" />

            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className={`inline-flex items-center gap-1.5 ${worker.running ? 'text-green-400' : 'text-slate-500'}`}>
                <span className={`w-2 h-2 rounded-full ${worker.running ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                {worker.running ? 'Running' : 'Stopped'}
              </span>
              <span>Tick: <span className="text-slate-900 font-mono">{worker.elapsed}</span></span>
              <span>Flights: <span className="text-slate-900 font-mono">{stats.total}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 pt-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'text-[#1e3a8a] border-[#1e3a8a]' : 'text-slate-500 border-transparent hover:text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {tab === 'Dashboard' && <DashboardTab stats={stats} flights={flights} formatTime={formatTime} />}
        {tab === 'Airport' && <AirportTab />}
        {tab === 'Notify' && <NotifyTab flights={flights} />}
      </div>
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Dashboard â€” flight stats + live flight table
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const STATUS_BADGE = {
  scheduled: 'bg-slate-500/20 text-slate-500',
  boarding: 'bg-[#1e3a8a]/20 text-[#1e3a8a]',
  final_call: 'bg-orange-500/20 text-orange-400',
  delayed: 'bg-red-500/20 text-red-400',
  departed: 'bg-green-500/20 text-green-400',
  arrived: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

function DashboardTab({ stats, flights, formatTime }) {
  const [qrFlight, setQrFlight] = useState(null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <StatCard label="Total" value={stats.total} color="text-slate-900" />
        <StatCard label="Scheduled" value={stats.scheduled} color="text-slate-500" />
        <StatCard label="Boarding" value={stats.boarding} color="text-[#1e3a8a]" />
        <StatCard label="Final Call" value={stats.final} color="text-orange-400" />
        <StatCard label="Delayed" value={stats.delayed} color="text-red-400" />
        <StatCard label="Departed" value={stats.departed} color="text-green-400" />
        <StatCard label="Cancelled" value={stats.cancelled} color="text-red-400" />
      </div>

      <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Live Flights â€” click for ticket QR</h3>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Flight</th>
                <th className="text-left px-3 py-2.5">Route</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Gate</th>
                <th className="text-left px-3 py-2.5">Time</th>
                <th className="text-center px-3 py-2.5">QR</th>
              </tr>
            </thead>
            <tbody>
              {flights.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-600">No flights â€” start the worker</td></tr>
              ) : flights.map((f) => (
                <tr key={f.id} onClick={() => setQrFlight(f)}
                  className="border-b border-slate-200 hover:bg-white cursor-pointer">
                  <td className="px-4 py-2 font-medium text-slate-900 whitespace-nowrap">{f.flight_number}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{f.origin_code || '?'} â†’ {f.destination_code || '?'}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${STATUS_BADGE[f.status] || 'bg-slate-100 text-slate-500'}`}>
                      {f.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{f.gate || '-'}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs font-mono">{formatTime(f.scheduled_at)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[#1e3a8a] text-xs">View</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {qrFlight && (
        <TicketQRModal flight={qrFlight} formatTime={formatTime} onClose={() => setQrFlight(null)} />
      )}
    </div>
  )
}

function TicketQRModal({ flight, formatTime, onClose }) {
  const qrData = JSON.stringify({
    type: 'skyguide_ticket',
    flight_id: flight.id,
    flight_number: flight.flight_number,
    origin_code: flight.origin_code,
    destination_code: flight.destination_code,
    gate: flight.gate,
    terminal: flight.terminal,
    scheduled_at: flight.scheduled_at,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/80" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4 p-6 text-center">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Boarding Pass</p>
        <p className="text-2xl font-bold text-slate-900 mb-1">{flight.flight_number}</p>
        <p className="text-sm text-slate-500 mb-4">
          {flight.origin_code || '?'} â†’ {flight.destination_code || '?'}
        </p>

        <div className="bg-slate-50 rounded-xl p-4 mb-4 inline-block">
          <QRCodeSVG value={qrData} size={200} level="M" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-left mb-2">
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Gate</p>
            <p className="text-sm font-bold text-slate-900">{flight.gate || '--'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Terminal</p>
            <p className="text-sm font-bold text-slate-900">{flight.terminal || '--'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase font-semibold">Time</p>
            <p className="text-sm font-bold text-slate-900">{formatTime(flight.scheduled_at)}</p>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 mt-3">Scan this QR from the SkyGuide app to add to My Flights</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Airport â€” map upload + interactive POI editor
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function AirportTab() {
  const { airport, pois, setPois, setAirport } = useStore()
  const [uploading, setUploading] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', category_id: 1, gate_number: '' })
  const fileRef = useRef(null)

  const CATEGORIES = [
    { id: 1, slug: 'gate' }, { id: 2, slug: 'checkin' }, { id: 3, slug: 'security' },
    { id: 4, slug: 'passport' }, { id: 5, slug: 'baggage' }, { id: 6, slug: 'restroom' },
    { id: 7, slug: 'elevator' }, { id: 8, slug: 'escalator' }, { id: 9, slug: 'stairs' },
    { id: 10, slug: 'lounge' }, { id: 11, slug: 'food' }, { id: 12, slug: 'retail' },
    { id: 13, slug: 'charging' }, { id: 14, slug: 'medical' }, { id: 15, slug: 'info' },
    { id: 16, slug: 'exit' },
  ]

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post('/admin/upload-map', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Reload airport to get new floor_plan_url
      const { data: airports } = await getAirports()
      if (airports?.[0]) setAirport(airports[0])
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handlePoiDrag = async (poi, newX, newY) => {
    const id = poi.poi_id || poi.id
    try {
      await api.put(`/admin/pois/${id}`, { x_m: newX, y_m: newY })
      setPois(pois.map((p) => (p.poi_id || p.id) === id ? { ...p, x_m: newX, y_m: newY } : p))
    } catch {}
  }

  const handleMapClick = async (x_m, y_m) => {
    if (!addMode || !addForm.name || !airport) return
    try {
      await api.post('/admin/pois', {
        airport_id: airport.id,
        name: addForm.name,
        category_id: addForm.category_id,
        gate_number: addForm.gate_number || null,
        x_m, y_m,
      })
      // Reload POIs
      const { data } = await getAirportPOIs(airport.id)
      setPois(data)
      setAddForm({ name: '', category_id: 1, gate_number: '' })
      setAddMode(false)
    } catch {}
  }

  const handleDeletePoi = async (poi) => {
    const id = poi.poi_id || poi.id
    try {
      await api.delete(`/admin/pois/${id}`)
      setPois(pois.filter((p) => (p.poi_id || p.id) !== id))
    } catch {}
  }

  const floorPlanUrl = airport?.floor_plan_url || '/assets/floorplan.svg'
  const bounds = useMemo(
    () => airport ? [[0, 0], [airport.height_m, airport.width_m]] : [[0, 0], [200, 400]],
    [airport]
  )

  return (
    <div className="space-y-4">
      {/* Map Upload */}
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Floor Plan</h3>
        <input ref={fileRef} type="file" accept="image/*,.svg" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 disabled:bg-slate-100 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload Map'}
        </button>
        <span className="text-xs text-slate-600 truncate max-w-xs">{floorPlanUrl}</span>
      </div>

      {/* Add POI form */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Name</label>
          <input
            value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
            placeholder="Gate B12"
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50 w-36"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Category</label>
          <select
            value={addForm.category_id} onChange={(e) => setAddForm({ ...addForm, category_id: +e.target.value })}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50"
          >
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.slug}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase mb-0.5">Gate #</label>
          <input
            value={addForm.gate_number} onChange={(e) => setAddForm({ ...addForm, gate_number: e.target.value })}
            placeholder="B12"
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50 w-20"
          />
        </div>
        <button
          onClick={() => setAddMode(!addMode)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            addMode
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
          }`}
        >
          {addMode ? 'Click map to place...' : '+ Add POI'}
        </button>
      </div>

      {/* Interactive map */}
      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: '50vh' }}>
        <MapContainer
          key={floorPlanUrl}
          crs={L.CRS.Simple}
          bounds={bounds}
          maxBounds={bounds}
          maxBoundsViscosity={1.0}
          zoomSnap={0.25}
          zoomDelta={0.5}
          minZoom={-2}
          maxZoom={4}
          attributionControl={false}
          style={{ width: '100%', height: '100%', background: '#0b1120' }}
        >
          <ImageOverlay url={floorPlanUrl} bounds={bounds} opacity={0.9} />
          <MapFitter bounds={bounds} />
          {addMode && <ClickHandler onClick={handleMapClick} />}
          {pois.map((p) => (
            <DraggablePoi
              key={p.poi_id || p.id}
              poi={p}
              onDragEnd={handlePoiDrag}
              onDelete={handleDeletePoi}
            />
          ))}
        </MapContainer>
      </div>

      {/* POI list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-60">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-3 py-2">Cat</th>
                <th className="text-left px-3 py-2">Gate</th>
                <th className="text-left px-3 py-2">Pos</th>
                <th className="text-right px-4 py-2">Del</th>
              </tr>
            </thead>
            <tbody>
              {pois.map((p) => (
                <tr key={p.poi_id || p.id} className="border-b border-slate-200 hover:bg-white">
                  <td className="px-4 py-1.5 text-slate-900 text-xs">{p.name}</td>
                  <td className="px-3 py-1.5 text-slate-500 text-xs">{p.category}</td>
                  <td className="px-3 py-1.5 text-slate-500 text-xs">{p.gate_number || '-'}</td>
                  <td className="px-3 py-1.5 text-slate-600 text-[10px] font-mono">{p.x_m?.toFixed(0)},{p.y_m?.toFixed(0)}</td>
                  <td className="px-4 py-1.5 text-right">
                    <button onClick={() => handleDeletePoi(p)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MapFitter({ bounds }) {
  const map = useMap()
  useEffect(() => { map.fitBounds(bounds) }, [bounds, map])
  return null
}

function ClickHandler({ onClick }) {
  const map = useMap()
  useEffect(() => {
    map.dragging.disable()
    return () => map.dragging.enable()
  }, [map])
  useMapEvents({
    click: (e) => onClick(e.latlng.lng, e.latlng.lat),
  })
  return null
}

function DraggablePoi({ poi, onDragEnd, onDelete }) {
  const icon = useMemo(() => L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:#3b82f6;border:2px solid #1d4ed8;
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:8px;font-weight:700;
      box-shadow:0 2px 8px rgba(59,130,246,.5);cursor:grab;
    ">${(poi.name || '?')[0]}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  }), [poi.name])

  const eventHandlers = useMemo(() => ({
    dragend: (e) => {
      const { lat, lng } = e.target.getLatLng()
      onDragEnd(poi, lng, lat) // lng = x_m, lat = y_m
    },
  }), [poi, onDragEnd])

  return (
    <Marker
      position={[poi.y_m, poi.x_m]}
      icon={icon}
      draggable
      eventHandlers={eventHandlers}
    >
      <Popup>
        <div className="text-xs space-y-1" style={{ color: '#e2e8f0', minWidth: 120 }}>
          <p className="font-bold">{poi.name}</p>
          <p className="text-slate-500">{poi.category} {poi.gate_number ? `(${poi.gate_number})` : ''}</p>
          <p className="text-slate-500">x:{poi.x_m?.toFixed(1)} y:{poi.y_m?.toFixed(1)}</p>
          <button
            onClick={() => onDelete(poi)}
            style={{ color: '#f87171', fontSize: 10, marginTop: 4, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            Delete POI
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Notify Tab
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

function NotifyTab({ flights }) {
  const [notifForm, setNotifForm] = useState({ title: '', body: '', priority: 'normal' })
  const [announceText, setAnnounceText] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  const handleSendNotif = async () => {
    setSending(true)
    try {
      const { data } = await api.post('/admin/notify', notifForm)
      setResult(`Notification queued to ${data.queued} subscriber(s)`)
      setNotifForm({ title: '', body: '', priority: 'normal' })
    } catch { setResult('Failed to send') }
    finally { setSending(false) }
  }

  const handleAnnounce = async () => {
    setSending(true)
    try {
      const { data } = await api.post('/admin/announce', { message: announceText })
      setResult(`PA sent to ${data.queued} subscriber(s)`)
      setAnnounceText('')
    } catch { setResult('Failed') }
    finally { setSending(false) }
  }

  const boardingFlights = flights.filter((f) => f.status === 'boarding')

  return (
    <div className="space-y-6">
      {result && (
        <div className="bg-[#1e3a8a]/10 border border-[#1e3a8a]/20 text-[#1e3a8a] text-sm px-4 py-2.5 rounded-xl flex items-center justify-between">
          <span>{result}</span>
          <button onClick={() => setResult(null)} className="hover:text-slate-900 ml-2">&times;</button>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-3">Push Notification</h3>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <input placeholder="Title" value={notifForm.title} onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50" />
          <textarea placeholder="Body" value={notifForm.body} onChange={(e) => setNotifForm({ ...notifForm, body: e.target.value })} rows={2}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50 resize-none" />
          <div className="flex items-center gap-3">
            <select value={notifForm.priority} onChange={(e) => setNotifForm({ ...notifForm, priority: e.target.value })}
              className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none">
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button onClick={handleSendNotif} disabled={sending || !notifForm.title}
              className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 disabled:bg-slate-100 text-white text-sm rounded-lg transition-colors">
              Send
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-3">PA Announcement</h3>
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <textarea placeholder="Announcement text..." value={announceText} onChange={(e) => setAnnounceText(e.target.value)} rows={2}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50 resize-none" />
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleAnnounce} disabled={sending || !announceText}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-100 text-slate-900 text-sm rounded-lg transition-colors">
              Broadcast
            </button>
            {boardingFlights.slice(0, 3).map((f) => (
              <button key={f.id}
                onClick={() => setAnnounceText(`Attention passengers: Flight ${f.flight_number} is now boarding at Gate ${f.raw_source?.gate || 'â€”'}. Please proceed with your boarding pass.`)}
                className="px-2 py-1 text-[10px] bg-[#1e3a8a]/10 text-[#1e3a8a] rounded-md hover:bg-[#1e3a8a]/90/20">
                {f.flight_number}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


