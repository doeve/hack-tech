import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import {
  getAirports, getAirportPOIs, getNavGraph, getRoute,
  createSession,
} from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'
import FloorMap from '../components/Map/FloorMap'
import SearchBar from '../components/Navigation/SearchBar'
import InstructionBanner from '../components/Navigation/InstructionBanner'
import ETABar from '../components/Navigation/ETABar'
import AccessibilityPanel from '../components/Accessibility/AccessibilityPanel'
import MapFABs from './map/MapFABs'
import PositionBadge from './map/PositionBadge'

export default function MapPage() {
  const navigate = useNavigate()
  const {
    airport, setAirport, setPois, setNavGraph,
    navGraph, pois, session, setSession,
    position, setPosition, setRoute, route,
    accessProfile,
  } = useStore()

  const [loading, setLoading] = useState(true)
  const [showAccessibility, setShowAccessibility] = useState(false)
  const [error, setError] = useState(null)
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
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
      <div className="h-full flex items-center justify-center bg-slate-900 p-4">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-blue-400 text-sm hover:text-blue-300">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <FloorMap onMapClick={handleMapClick} onSelectDestination={handleSelectDestination} />
      <div className="absolute top-4 left-4 right-4 z-[1000]">
        <SearchBar onSelectDestination={handleSelectDestination} />
      </div>
      {route && (
        <div className="absolute bottom-24 left-4 right-4 z-[1000] space-y-2">
          <InstructionBanner />
          <ETABar />
        </div>
      )}
      <MapFABs
        onAR={() => navigate('/ar')}
        onAccessibility={() => setShowAccessibility(true)}
        onIdentity={() => navigate('/identity')}
        onDemo={() => navigate('/demo')}
      />
      <PositionBadge position={position} />
      {showAccessibility && (
        <AccessibilityPanel onClose={() => setShowAccessibility(false)} />
      )}
    </div>
  )
}
