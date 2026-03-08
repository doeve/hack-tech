import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'

// Smooth angular interpolation (shortest path around 360°)
function lerpAngle(from, to, t) {
  let diff = ((to - from + 540) % 360) - 180
  return from + diff * t
}

export default function BlueDot() {
  const map = useMap()
  const markerRef = useRef(null)
  const driftRef = useRef(null)
  const animRef = useRef(null)

  // Live state for smooth animation — bypasses React render cycle
  const displayPos = useRef({ x: 0, y: 0 })
  const targetPos = useRef({ x: 0, y: 0 })
  const displayHeading = useRef(0)
  const targetHeading = useRef(0)
  const driftRadius = useRef(0)
  const initialized = useRef(false)

  // Create Leaflet elements once
  useEffect(() => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:48px;height:48px;position:relative;">
        <div id="bd-cone" style="
          position:absolute; left:50%; top:50%;
          width:32px; height:32px;
          margin-left:-16px; margin-top:-16px;
          background: conic-gradient(from -20deg, transparent 0deg, rgba(59,130,246,0.25) 0deg, rgba(59,130,246,0.08) 40deg, transparent 40deg);
          border-radius:50%;
          transform: rotate(0deg);
          transition: none;
        "></div>
        <div style="
          position:absolute; left:50%; top:50%;
          width:16px; height:16px;
          margin-left:-8px; margin-top:-8px;
          border-radius:50%;
          background:#3b82f6; border:3px solid #fff;
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
          z-index:2;
        "></div>
        <div id="bd-pulse" style="
          position:absolute; left:50%; top:50%;
          width:16px; height:16px;
          margin-left:-8px; margin-top:-8px;
          border-radius:50%;
          border:2px solid #3b82f6;
          animation: bd-pulse-anim 2s ease-out infinite;
          z-index:1;
        "></div>
      </div>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    })
    markerRef.current = L.marker([0, 0], { icon, zIndexOffset: 1000, interactive: false }).addTo(map)

    driftRef.current = L.circle([0, 0], {
      radius: 0,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08,
      weight: 1,
      dashArray: '4,4',
      interactive: false,
    }).addTo(map)

    // Inject pulse keyframes if not already present
    if (!document.getElementById('bd-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'bd-pulse-style'
      style.textContent = `@keyframes bd-pulse-anim {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(3); opacity: 0; }
      }`
      document.head.appendChild(style)
    }

    return () => {
      markerRef.current?.remove()
      driftRef.current?.remove()
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [map])

  // Animation loop — runs at 60fps, smoothly interpolates position and heading
  useEffect(() => {
    const POS_LERP = 0.15 // position smoothing (0-1, higher = snappier)
    const HDG_LERP = 0.2  // heading smoothing

    const animate = () => {
      animRef.current = requestAnimationFrame(animate)

      if (!initialized.current) return

      // Smooth position
      displayPos.current.x += (targetPos.current.x - displayPos.current.x) * POS_LERP
      displayPos.current.y += (targetPos.current.y - displayPos.current.y) * POS_LERP

      // Smooth heading (shortest angular path)
      displayHeading.current = lerpAngle(displayHeading.current, targetHeading.current, HDG_LERP)

      const latlng = [displayPos.current.y, displayPos.current.x]
      markerRef.current?.setLatLng(latlng)
      driftRef.current?.setLatLng(latlng)
      driftRef.current?.setRadius(driftRadius.current)
      // Hide drift circle at zero radius to prevent ghost artifact during zoom
      if (driftRef.current) {
        const el = driftRef.current.getElement?.()
        if (el) el.style.display = driftRadius.current > 0.1 ? '' : 'none'
      }

      // Update cone rotation directly on DOM element
      const cone = document.getElementById('bd-cone')
      if (cone) {
        cone.style.transform = `rotate(${displayHeading.current}deg)`
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  // Subscribe to store position changes
  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      const pos = state.position
      if (!pos) return

      targetPos.current.x = pos.x_m
      targetPos.current.y = pos.y_m
      driftRadius.current = pos.drift_radius_m || 0

      if (!initialized.current) {
        // Snap immediately on first position (no lerp)
        displayPos.current.x = pos.x_m
        displayPos.current.y = pos.y_m
        displayHeading.current = pos.heading_deg || 0
        initialized.current = true
      }
    })
    // Also read initial state
    const pos = useStore.getState().position
    if (pos) {
      targetPos.current.x = pos.x_m
      targetPos.current.y = pos.y_m
      displayPos.current.x = pos.x_m
      displayPos.current.y = pos.y_m
      displayHeading.current = pos.heading_deg || 0
      driftRadius.current = pos.drift_radius_m || 0
      initialized.current = true
    }
    return unsub
  }, [])

  // Subscribe directly to IMU heading for instant rotation updates
  // This bypasses the store for heading — the cone updates at 60fps
  useEffect(() => {
    const handleOrientation = (e) => {
      let hdg = 0
      if (e.webkitCompassHeading !== undefined) {
        hdg = e.webkitCompassHeading
      } else if (e.alpha !== null) {
        hdg = (360 - e.alpha) % 360
      }
      targetHeading.current = hdg
    }
    window.addEventListener('deviceorientation', handleOrientation, { passive: true })
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [])

  return null
}
