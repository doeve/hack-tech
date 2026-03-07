import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'

export default function BlueDot() {
  const map = useMap()
  const { position } = useStore()
  const dotRef = useRef(null)
  const pulseRef = useRef(null)
  const headingRef = useRef(null)
  const driftRef = useRef(null)

  useEffect(() => {
    // Main blue dot
    const dotIcon = L.divIcon({
      className: '',
      html: `<div style="
        width: 16px; height: 16px; border-radius: 50%;
        background: #3b82f6; border: 3px solid #fff;
        box-shadow: 0 0 8px rgba(59,130,246,0.6);
        position: relative; z-index: 1000;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
    dotRef.current = L.marker([0, 0], { icon: dotIcon, zIndexOffset: 1000 }).addTo(map)

    // Pulse ring
    const pulseIcon = L.divIcon({
      className: '',
      html: `<div class="pulse-ring" style="
        width: 16px; height: 16px; border-radius: 50%;
        border: 2px solid #3b82f6; position: absolute;
        top: 0; left: 0;
      "></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
    pulseRef.current = L.marker([0, 0], { icon: pulseIcon, zIndexOffset: 999, interactive: false }).addTo(map)

    // Heading indicator (triangle/wedge pointing forward)
    headingRef.current = L.marker([0, 0], {
      icon: L.divIcon({
        className: '',
        html: `<div id="heading-wedge" style="
          width: 0; height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 20px solid rgba(59,130,246,0.7);
          transform-origin: center bottom;
          position: relative; top: -10px;
        "></div>`,
        iconSize: [16, 20],
        iconAnchor: [8, 20],
      }),
      zIndexOffset: 998,
      interactive: false,
    }).addTo(map)

    // Drift radius circle
    driftRef.current = L.circle([0, 0], {
      radius: 0,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 1,
      dashArray: '4,4',
      interactive: false,
    }).addTo(map)

    return () => {
      dotRef.current?.remove()
      pulseRef.current?.remove()
      headingRef.current?.remove()
      driftRef.current?.remove()
    }
  }, [map])

  useEffect(() => {
    if (!position) return
    const latlng = [position.y_m, position.x_m]

    dotRef.current?.setLatLng(latlng)
    pulseRef.current?.setLatLng(latlng)
    headingRef.current?.setLatLng(latlng)
    driftRef.current?.setLatLng(latlng)

    // Update drift radius
    if (driftRef.current) {
      driftRef.current.setRadius(position.drift_radius_m || 0)
    }

    // Update heading rotation on the wedge element
    const wedge = document.getElementById('heading-wedge')
    if (wedge) {
      wedge.style.transform = `rotate(${position.heading_deg || 0}deg)`
    }
  }, [position])

  return null
}
