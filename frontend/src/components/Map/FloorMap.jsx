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

function MapController({ airport, imageBounds }) {
  const map = useMap()
  const didInit = useRef(false)
  const positionConfirmed = useStore((s) => s.positionConfirmed)

  useEffect(() => {
    if (!airport || didInit.current) return

    // Show ~200m vertically. In CRS.Simple zoom 0 = 1px per unit (metre).
    const VISIBLE_METRES = 100
    const containerH = map.getSize().y || 800
    const zoom = Math.log2(containerH / VISIBLE_METRES)

    if (positionConfirmed) {
      didInit.current = true
      const pos = useStore.getState().position
      map.setView([pos.y_m, pos.x_m], zoom, { animate: false })
    } else {
      // Temporarily show airport center until position is confirmed
      const fitBounds = imageBounds || [[0, 0], [airport.height_m, airport.width_m]]
      const center = L.latLngBounds(fitBounds).getCenter()
      map.setView(center, zoom, { animate: false })
    }
  }, [airport, imageBounds, map, positionConfirmed])

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

function ZoomToUser({ trigger }) {
  const map = useMap()

  useEffect(() => {
    if (!trigger) return
    const pos = useStore.getState().position
    const latlng = [pos.y_m, pos.x_m]
    map.flyTo(latlng, map.getZoom(), { duration: 0.5 })
  }, [trigger, map])

  return null
}

function MapRefExposer({ mapRef }) {
  const map = useMap()
  useEffect(() => {
    if (mapRef) mapRef.current = map
  }, [map, mapRef])
  return null
}

function ZoomHandler({ zoomDelta }) {
  const map = useMap()
  useEffect(() => {
    if (!zoomDelta) return
    if (zoomDelta > 0) map.zoomIn()
    else map.zoomOut()
  }, [zoomDelta, map])
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

// Nice round numbers for the scale bar
const SCALE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500]

function ScaleBar() {
  const map = useMap()
  const barRef = useRef(null)
  const labelRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const update = () => {
      rafRef.current = requestAnimationFrame(update)

      const size = map.getSize()
      if (!size.x || !barRef.current) return
      const left = map.containerPointToLatLng([0, size.y / 2])
      const right = map.containerPointToLatLng([size.x, size.y / 2])
      const metresPerPx = Math.abs(right.lng - left.lng) / size.x

      const targetMetres = metresPerPx * 100
      let best = SCALE_STEPS[0]
      for (const s of SCALE_STEPS) {
        if (s <= targetMetres * 1.5) best = s
      }

      const px = best / metresPerPx
      barRef.current.style.width = `${px}px`
      if (labelRef.current) {
        labelRef.current.textContent = best >= 1000 ? `${best / 1000} km` : `${best} m`
      }
    }

    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [map])

  return (
    <div style={{
      position: 'absolute', bottom: 96, left: 16, zIndex: 900,
      pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    }}>
      <span ref={labelRef} style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 2 }} />
      <div ref={barRef} style={{ position: 'relative', height: 6, minWidth: 1 }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: '#94a3b8', borderRadius: 2, opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: 1, height: 6, background: '#94a3b8', opacity: 0.5 }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 1, height: 6, background: '#94a3b8', opacity: 0.5 }} />
      </div>
    </div>
  )
}

export default function FloorMap({ onMapClick, onSelectDestination, clientRoute, zoomToUserTrigger, mapRef, zoomDelta }) {
  const { airport, floorSvgDims, positionConfirmed } = useStore()

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

      zoomSnap={0.25}
      zoomDelta={0.5}
      minZoom={-2}
      maxZoom={8}
      attributionControl={false}
      style={{ width: '100%', height: '100%', background: '#0b1120', zIndex: 0 }}
    >
      <ImageOverlay url={floorPlanUrl} bounds={imageBounds} opacity={0.9} />
      <MapController airport={airport} imageBounds={imageBounds} />
      <MapClickHandler onMapClick={onMapClick} />
      <ZoomToUser trigger={zoomToUserTrigger} />
      {mapRef && <MapRefExposer mapRef={mapRef} />}
      <ZoomHandler zoomDelta={zoomDelta} />
      {positionConfirmed && <BlueDot />}

      <RoutePolyline clientRoute={clientRoute} />
      <POIMarkers onSelectDestination={onSelectDestination} />
      <ScaleBar />
    </MapContainer>
  )
}
