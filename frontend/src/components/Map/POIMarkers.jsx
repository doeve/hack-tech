import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../../store'

const CATEGORY_COLORS = {
  gate: '#38bdf8',
  checkin: '#a78bfa',
  security: '#f87171',
  passport: '#f87171',
  baggage: '#fb923c',
  restroom: '#94a3b8',
  elevator: '#94a3b8',
  escalator: '#94a3b8',
  stairs: '#94a3b8',
  lounge: '#c084fc',
  food: '#fb923c',
  retail: '#34d399',
  charging: '#a3e635',
  medical: '#f43f5e',
  info: '#fbbf24',
  prayer: '#c084fc',
  play_area: '#34d399',
  taxi: '#fbbf24',
  train: '#38bdf8',
  exit: '#22c55e',
  emergency_exit: '#ef4444',
}

const CATEGORY_ICONS = {
  gate: 'G',
  checkin: 'C',
  security: 'S',
  passport: 'P',
  baggage: 'B',
  restroom: 'R',
  food: 'F',
  charging: 'Z',
  info: 'i',
  lounge: 'L',
  retail: '$',
  medical: '+',
  elevator: 'E',
  exit: 'X',
}

function createPOIIcon(poi) {
  const color = CATEGORY_COLORS[poi.category] || '#94a3b8'
  const letter = CATEGORY_ICONS[poi.category] || '?'
  const label = poi.gate_number || poi.name

  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:${color};display:flex;align-items:center;justify-content:center;
        font:bold 14px sans-serif;color:#0f172a;
        border:2px solid rgba(255,255,255,0.3);
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
      ">${letter}</div>
      <div style="
        font:11px sans-serif;color:${color};
        white-space:nowrap;margin-top:2px;
        text-shadow:0 1px 3px rgba(0,0,0,0.8);
      ">${label}</div>
    </div>`,
    iconSize: [28, 40],
    iconAnchor: [14, 14],
  })
}

export default function POIMarkers({ onSelectDestination }) {
  const map = useMap()
  const { pois } = useStore()
  const markersRef = useRef([])

  useEffect(() => {
    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (!pois?.length) return

    for (const poi of pois) {
      const marker = L.marker([poi.y_m, poi.x_m], {
        icon: createPOIIcon(poi),
        zIndexOffset: 500,
      }).addTo(map)

      const popupContent = `
        <div style="min-width:140px;">
          <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${poi.name}</div>
          <div style="font-size:12px;color:#94a3b8;margin-bottom:6px;">${poi.category}</div>
          ${poi.gate_number ? `<div style="font-size:12px;">Gate: ${poi.gate_number}</div>` : ''}
          <button
            onclick="window.__selectDestination('${poi.poi_id || poi.id}')"
            style="
              margin-top:6px;padding:4px 12px;border-radius:6px;
              background:#3b82f6;color:white;border:none;cursor:pointer;
              font-size:12px;width:100%;
            "
          >Navigate here</button>
        </div>
      `

      marker.bindPopup(popupContent, {
        className: 'dark-popup',
        closeButton: true,
      })

      markersRef.current.push(marker)
    }

    // Global callback for popup button
    window.__selectDestination = (poiId) => {
      if (onSelectDestination) onSelectDestination(poiId)
      map.closePopup()
    }

    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      delete window.__selectDestination
    }
  }, [pois, map, onSelectDestination])

  return null
}
