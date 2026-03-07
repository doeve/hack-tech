import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import {
  getAirports, getAirportPOIs, getNavGraph, getRoute,
  createSession,
} from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'
import FloorMap from '../components/Map/FloorMap'
import InstructionBanner from '../components/Navigation/InstructionBanner'
import BottomNav from '../components/BottomNav'

export default function MapPage() {
  const navigate = useNavigate()
  const {
    airport, setAirport, setPois, setNavGraph,
    navGraph, pois, session, setSession,
    position, setPosition, setRoute, route,
    accessProfile,
  } = useStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [floor, setFloor] = useState('L2')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const { confirmPosition } = useWebSocket(session?.id)

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

  const handleSelectDestination = useCallback(async (poiId) => {
    if (!airport || !navGraph?.nodes?.length) return
    const destNode = navGraph.nodes.find((n) => n.poi_id === poiId)
    if (!destNode) return
    let closestNode = navGraph.nodes[0]
    let closestDist = Infinity
    for (const node of navGraph.nodes) {
      const dx = node.x_m - position.x_m
      const dy = node.y_m - position.y_m
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
      const { data: sess } = await createSession({
        airport_id: airport.id,
        start_x_m: position.x_m,
        start_y_m: position.y_m,
        start_confirmed_by: 'manual_set',
        destination_poi_id: poiId,
        route_mode: mode,
        nav_mode: accessProfile.nav_mode || 'standard',
        ar_enabled: accessProfile.ar_enabled,
      })
      setSession(sess)
    } catch (err) {
      console.error('Failed to compute route:', err)
    }
  }, [airport, navGraph, position, accessProfile, setRoute, setSession])

  const handleMapClick = useCallback((x_m, y_m) => {
    setPosition({
      x_m, y_m,
      heading_deg: position.heading_deg,
      drift_radius_m: 0,
      source: 'manual_set',
    })
    confirmPosition(x_m, y_m)
  }, [position, setPosition, confirmPosition])

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-3 border-[#1e3a8a]
                          border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading airport...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-[#1e3a8a] text-sm hover:text-blue-300">Retry</button>
        </div>
      </div>
    )
  }

  // Get current route instruction for the next step card
  const currentInstruction = route?.instructions?.[useStore.getState().currentStepIndex]
  const remainingMins = route ? Math.ceil(
    route.instructions?.slice(useStore.getState().currentStepIndex)
      .reduce((sum, i) => sum + (i.distance_m || 0), 0) / 1.2 / 60
  ) : null

  return (
    <div className="relative h-full w-full bg-slate-50">
      {/* Map */}
      <FloorMap onMapClick={handleMapClick} onSelectDestination={handleSelectDestination} />

      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <div className="flex items-center gap-2 bg-white backdrop-blur-md rounded-2xl border border-slate-200 px-4 py-2.5">
          <svg className="w-4.5 h-4.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search Gates, Lounges, or..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-500 focus:outline-none"
          />
          <button className="text-slate-500 hover:text-slate-900 p-0.5">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4-4h8m-4-12a3 3 0 00-3 3v4a3 3 0 006 0V8a3 3 0 00-3-3z" />
            </svg>
          </button>
          <button className="relative text-slate-500 hover:text-slate-900 p-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-400 rounded-full" />
          </button>
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && filteredPois.length > 0 && (
          <div className="mt-2 bg-white backdrop-blur-md border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
            {filteredPois.map((poi) => (
              <button
                key={poi.poi_id || poi.id}
                onClick={() => handlePoiSelect(poi)}
                className="w-full px-4 py-3 text-left hover:bg-slate-100 flex items-center gap-3 border-b border-slate-200 last:border-b-0"
              >
                <span className="text-[10px] uppercase tracking-wider text-slate-500 w-14">{poi.category}</span>
                <span className="text-sm text-slate-900 flex-1">{poi.name}</span>
                {poi.gate_number && (
                  <span className="text-xs bg-[#1e3a8a]/20 text-[#1e3a8a] px-2 py-0.5 rounded">{poi.gate_number}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floor Level Selector */}
      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-1">
        {['L3', 'L2', 'L1'].map((lvl) => (
          <button
            key={lvl}
            onClick={() => setFloor(lvl)}
            className={`w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${
              floor === lvl
                ? 'bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/30'
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="absolute right-4 z-[1000] flex flex-col gap-1.5" style={{ top: '220px' }}>
        <button className="w-9 h-9 bg-white backdrop-blur border border-slate-200 rounded-lg flex items-center justify-center text-slate-900 text-lg hover:bg-slate-100 transition-colors">
          +
        </button>
        <button className="w-9 h-9 bg-white backdrop-blur border border-slate-200 rounded-lg flex items-center justify-center text-slate-900 text-lg hover:bg-slate-100 transition-colors">
          -
        </button>
        <button className="w-9 h-9 bg-white backdrop-blur border border-slate-200 rounded-lg flex items-center justify-center text-[#1e3a8a] hover:bg-slate-100 transition-colors mt-1">
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      {/* AR Mode Button */}
      <div className="absolute bottom-40 left-4 z-[1000]">
        <button
          onClick={() => navigate('/ar')}
          className="flex items-center gap-2 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white px-5 py-2.5 rounded-full shadow-lg shadow-blue-900/30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide">AR MODE</span>
        </button>
      </div>

      {/* User Location Dot Indicator */}
      <div className="absolute bottom-40 left-5 z-[999]" style={{ display: 'none' }}>
        <div className="w-3 h-3 bg-[#1e3a8a] rounded-full shadow-lg shadow-blue-500/50" />
      </div>

      {/* Next Step Card */}
      {route && currentInstruction && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000]">
          <div className="bg-white backdrop-blur-md rounded-2xl border border-slate-200 px-4 py-3 shadow-xl">
            <p className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-1">Next Step</p>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-[#1e3a8a]/15 rounded-xl flex items-center justify-center text-[#1e3a8a]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 text-sm font-medium truncate">
                  {currentInstruction.display_text || currentInstruction.tts_text || 'Continue ahead'}
                </p>
              </div>
              {remainingMins != null && remainingMins > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-[#1e3a8a] text-xl font-bold leading-none">{remainingMins}</p>
                  <p className="text-[#1e3a8a] text-xs">mins</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instruction Banner (fallback when no next step card) */}
      {route && !currentInstruction && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000]">
          <InstructionBanner />
        </div>
      )}

      <BottomNav />
    </div>
  )
}


