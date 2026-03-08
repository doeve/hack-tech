import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'

export default function RoutePolyline() {
  const map = useMap()
  const { route, navGraph, currentStepIndex } = useStore()
  const routeLayerRef = useRef(null)
  const activeLayerRef = useRef(null)

  useEffect(() => {
    // Clean up previous layers
    routeLayerRef.current?.remove()
    activeLayerRef.current?.remove()

    if (!route?.node_sequence || !navGraph?.nodes?.length) return

    // Build a lookup of node positions by id
    const nodeMap = {}
    for (const n of navGraph.nodes) {
      nodeMap[n.id] = n
    }

    // Convert node_sequence to [lat, lng] = [y_m, x_m] coords
    const coords = route.node_sequence
      .map((nid) => nodeMap[nid])
      .filter(Boolean)
      .map((n) => [n.y_m, n.x_m])

    if (coords.length < 2) return

    // Full route line (subtle background)
    routeLayerRef.current = L.polyline(coords, {
      color: '#64748b',
      weight: 4,
      opacity: 0.4,
      dashArray: '8,8',
      interactive: false,
    }).addTo(map)

    // Active/remaining route (bright, animated)
    const activeCoords = coords.slice(Math.max(0, currentStepIndex))
    if (activeCoords.length >= 2) {
      activeLayerRef.current = L.polyline(activeCoords, {
        color: '#38bdf8',
        weight: 5,
        opacity: 0.8,
        dashArray: '12,8',
        className: 'route-animated',
        interactive: false,
      }).addTo(map)
    }

    return () => {
      routeLayerRef.current?.remove()
      activeLayerRef.current?.remove()
    }
  }, [route, navGraph, currentStepIndex, map])

  return null
}


