import { useEffect, useMemo } from 'react'
import { MapContainer, ImageOverlay, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'
import BlueDot from './BlueDot'
import RoutePolyline from './RoutePolyline'
import POIMarkers from './POIMarkers'

// CRS.Simple: [y, x] = [lat, lng]. We work in metres directly.
// Bounds: [[0,0], [height_m, width_m]] so y_m maps to lat and x_m maps to lng.

function MapController({ airport }) {
  const map = useMap()

  useEffect(() => {
    if (!airport) return
    const bounds = [[0, 0], [airport.height_m, airport.width_m]]
    map.setMaxBounds(bounds)
    map.fitBounds(bounds)
  }, [airport, map])

  return null
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        // e.latlng: lat=y_m, lng=x_m
        onMapClick(e.latlng.lng, e.latlng.lat)
      }
    },
  })
  return null
}

export default function FloorMap({ onMapClick, onSelectDestination }) {
  const { airport, route, pois, navGraph } = useStore()

  const bounds = useMemo(() => {
    if (!airport) return [[0, 0], [200, 400]]
    return [[0, 0], [airport.height_m, airport.width_m]]
  }, [airport])

  const floorPlanUrl = airport?.floor_plan_url || '/assets/floorplan.svg'

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      maxBounds={bounds}
      maxBoundsViscosity={1.0}
      zoomSnap={0.25}
      zoomDelta={0.5}
      minZoom={-2}
      maxZoom={4}
      attributionControl={false}
      style={{ width: '100%', height: '100%', background: '#0f172a' }}
    >
      <ImageOverlay url={floorPlanUrl} bounds={bounds} opacity={0.9} />
      <MapController airport={airport} />
      <MapClickHandler onMapClick={onMapClick} />
      <BlueDot />
      <RoutePolyline />
      <POIMarkers onSelectDestination={onSelectDestination} />
    </MapContainer>
  )
}
