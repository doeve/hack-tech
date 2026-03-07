import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, ImageOverlay, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'
import { useStylizedSvg } from '../../hooks/useStylizedSvg'
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

// Debug: draw parsed walls as red lines to verify coordinate alignment
function WallDebugOverlay() {
  const map = useMap()
  const layerRef = useRef(null)
  const { floorWalls, airport, floorSvgDims } = useStore()

  useEffect(() => {
    layerRef.current?.remove()
    if (!floorWalls?.length || !airport) return

    const fb = computeFloorBounds(airport, floorSvgDims)
    const group = L.layerGroup()
    for (const w of floorWalls) {
      // Walls are in normalized 0..1 coords — convert to fitted image bounds
      const y1 = fb.y0 + w.y1 * fb.h, x1 = fb.x0 + w.x1 * fb.w
      const y2 = fb.y0 + w.y2 * fb.h, x2 = fb.x0 + w.x2 * fb.w
      L.polyline([[y1, x1], [y2, x2]], {
        color: 'red', weight: 2, opacity: 0.6, interactive: false,
      }).addTo(group)
    }
    group.addTo(map)
    layerRef.current = group

    return () => { group.remove() }
  }, [floorWalls, airport, floorSvgDims, map])

  return null
}

function ZoomToUser({ trigger }) {
  const map = useMap()
  const { position } = useStore()

  useEffect(() => {
    if (!trigger) return
    const latlng = [position.y_m, position.x_m]
    map.flyTo(latlng, 2, { duration: 0.5 })
  }, [trigger, map, position])

  return null
}

// Compute image bounds that preserve SVG aspect ratio, fitted within airport bounds
function computeFloorBounds(airport, svgDims) {
  const W = airport.width_m, H = airport.height_m
  if (!svgDims) return { x0: 0, y0: 0, w: W, h: H }
  const svgAspect = svgDims.w / svgDims.h
  const mapAspect = W / H
  if (svgAspect >= mapAspect) {
    // SVG wider — fit to width, shrink height
    const imgH = W / svgAspect
    return { x0: 0, y0: (H - imgH) / 2, w: W, h: imgH }
  }
  // SVG taller — fit to height, shrink width
  const imgW = H * svgAspect
  return { x0: (W - imgW) / 2, y0: 0, w: imgW, h: H }
}

export default function FloorMap({ onMapClick, onSelectDestination, clientRoute, zoomToUserTrigger }) {
  const { airport, floorSvgDims } = useStore()

  const bounds = useMemo(() => {
    if (!airport) return [[0, 0], [200, 400]]
    return [[0, 0], [airport.height_m, airport.width_m]]
  }, [airport])

  // Image bounds preserve the SVG aspect ratio within the map
  const imageBounds = useMemo(() => {
    if (!airport) return [[0, 0], [200, 400]]
    const fb = computeFloorBounds(airport, floorSvgDims)
    return [[fb.y0, fb.x0], [fb.y0 + fb.h, fb.x0 + fb.w]]
  }, [airport, floorSvgDims])

  const rawFloorPlanUrl = airport?.floor_plan_url || '/assets/floorplan.svg'
  const floorPlanUrl = useStylizedSvg(rawFloorPlanUrl)

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
      style={{ width: '100%', height: '100%', background: '#0b1120' }}
    >
      <ImageOverlay url={floorPlanUrl} bounds={imageBounds} opacity={0.9} />
      <MapController airport={airport} />
      <MapClickHandler onMapClick={onMapClick} />
      <ZoomToUser trigger={zoomToUserTrigger} />
      <BlueDot />
      <WallDebugOverlay />
      <RoutePolyline clientRoute={clientRoute} />
      <POIMarkers onSelectDestination={onSelectDestination} />
    </MapContainer>
  )
}
