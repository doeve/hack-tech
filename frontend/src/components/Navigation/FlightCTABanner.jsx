import { useState, useEffect, useRef, useCallback } from 'react'
import { useHapticController } from '../Accessibility/HapticController'
import { useTTS } from '../Accessibility/TTSController'

function formatCountdown(ms) {
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  const s = Math.floor((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatCountdownSpoken(ms) {
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} and ${m} minute${m > 1 ? 's' : ''}`
  if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`
  return `${m} minute${m > 1 ? 's' : ''}`
}

export default function FlightCTABanner({ flight, onConfirm }) {
  const [countdown, setCountdown] = useState('')
  const [sliderX, setSliderX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const trackRef = useRef(null)
  const thumbSize = 52
  const announcedRef = useRef(false)

  const { vibrateForEvent } = useHapticController()
  const { announceFlightApproaching } = useTTS()

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const depTime = new Date(flight.estimated_at || flight.scheduled_at).getTime()
      setCountdown(formatCountdown(depTime - Date.now()))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [flight])

  // Announce flight on mount (once) for blind users + vibrate for deaf users
  useEffect(() => {
    if (announcedRef.current) return
    announcedRef.current = true
    vibrateForEvent('flight_alert')
    const depTime = new Date(flight.estimated_at || flight.scheduled_at).getTime()
    const ms = depTime - Date.now()
    if (ms > 0) {
      announceFlightApproaching(flight, formatCountdownSpoken(ms))
    }
  }, [flight, vibrateForEvent, announceFlightApproaching])

  // Slide interaction
  const getMaxX = useCallback(() => {
    if (!trackRef.current) return 200
    return trackRef.current.offsetWidth - thumbSize - 8
  }, [])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    e.target.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e) => {
    if (!dragging || confirmed) return
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const x = e.clientX - rect.left - thumbSize / 2 - 4
    const maxX = getMaxX()
    setSliderX(Math.max(0, Math.min(x, maxX)))
  }, [dragging, confirmed, getMaxX])

  const handlePointerUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    const maxX = getMaxX()
    if (sliderX > maxX * 0.8) {
      // Confirmed!
      setSliderX(maxX)
      setConfirmed(true)
      vibrateForEvent('confirm')
      setTimeout(() => onConfirm(flight), 600)
    } else {
      // Spring back
      setSliderX(0)
    }
  }, [dragging, sliderX, getMaxX, onConfirm, flight, vibrateForEvent])

  const maxX = getMaxX()
  const progress = maxX > 0 ? sliderX / maxX : 0

  return (
    <div className="absolute bottom-20 left-0 right-0 z-[1100] pointer-events-none">
      {/* Gradient backdrop */}
      <div className="pointer-events-auto"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)' }}>
        <div className="px-5 pt-10 pb-5">
          {/* Flight info */}
          <div className="text-center mb-4">
            <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Upcoming Flight</p>
            <p className="text-white text-lg font-bold">
              Flying to <span className="text-blue-400">{flight.destination_code || flight.destination_city || '---'}</span> in <span className="text-blue-400">{countdown}</span>
            </p>
            <p className="text-slate-400 text-sm mt-0.5">{flight.flight_number} &middot; Gate {flight.gate || '--'}</p>
          </div>

          {/* Slide to confirm track */}
          <div ref={trackRef}
            className="relative h-14 bg-slate-800/80 border border-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Progress fill */}
            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${(progress * 100).toFixed(1)}%`,
                background: `linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,0.3))`,
                transition: dragging ? 'none' : 'width 0.3s ease-out',
              }}
            />

            {/* Label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ opacity: confirmed ? 0 : 1 - progress * 0.8, transition: 'opacity 0.2s' }}>
              <span className="text-sm font-medium text-slate-400 select-none">
                {confirmed ? '' : 'Slide to begin journey'}
              </span>
              {!confirmed && !dragging && (
                <svg className="w-4 h-4 text-slate-500 ml-1.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              )}
            </div>

            {/* Thumb */}
            <div
              className="absolute top-1 bottom-1 flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing select-none touch-none"
              style={{
                left: 4 + sliderX,
                width: thumbSize,
                background: confirmed
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                boxShadow: '0 2px 12px rgba(59,130,246,0.4)',
                transition: dragging ? 'none' : 'left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onPointerDown={handlePointerDown}
            >
              {confirmed ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  style={{ transform: `rotate(${-45 + progress * 45}deg)`, transition: dragging ? 'none' : 'transform 0.3s' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
