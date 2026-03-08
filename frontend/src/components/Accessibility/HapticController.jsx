import { useCallback } from 'react'
import { useStore } from '../../store'

/**
 * Triggers vibration patterns via the Vibration API.
 * Reads haptics_enabled and haptic_intensity from the accessibility profile.
 */
export function useHapticController() {
  const { accessProfile } = useStore()

  const vibrate = useCallback((pattern) => {
    if (!accessProfile.haptics_enabled) return
    if (!navigator.vibrate) return

    const intensity = accessProfile.haptic_intensity || 1.0
    const scaled = Array.isArray(pattern)
      ? pattern.map((v) => Math.round(v * intensity))
      : [Math.round(pattern * intensity)]

    navigator.vibrate(scaled)
  }, [accessProfile])

  // Navigation instruction patterns — distinct for each type
  const vibrateForInstruction = useCallback((instructionType) => {
    const patterns = {
      continue_straight: [80],
      turn_left:         [200, 80, 200],
      turn_right:        [200, 80, 200, 80, 200],
      turn_slight_left:  [120, 80, 120],
      turn_slight_right: [120, 80, 120, 80, 120],
      u_turn:            [300, 60, 300, 60, 300],
      arrive:            [150, 60, 150, 60, 400],
    }
    vibrate(patterns[instructionType] || [80])
  }, [vibrate])

  // Journey-level events — longer, more distinctive patterns
  const vibrateForEvent = useCallback((event) => {
    const patterns = {
      // Arrived at a journey waypoint (check-in, security, etc.)
      waypoint_arrival:  [300, 100, 300, 100, 300],
      // Journey complete — celebration: three quick + one long
      journey_complete:  [100, 60, 100, 60, 100, 120, 500],
      // Flight approaching — attention grab
      flight_alert:      [200, 100, 200, 100, 400],
      // Flight status change (boarding, gate change, etc.)
      status_change:     [250, 80, 250],
      // Confirming an action (slide-to-confirm, position set)
      confirm:           [60, 40, 120],
      // Warning (off route, obstacle)
      warning:           [400, 100, 400],
      // Proximity to a POI
      proximity:         [60, 40, 60],
    }
    vibrate(patterns[event] || [150])
  }, [vibrate])

  return { vibrate, vibrateForInstruction, vibrateForEvent }
}

export default function HapticController() {
  const { vibrateForInstruction, vibrateForEvent } = useHapticController()

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        Haptic Test
      </p>
      <div className="flex flex-wrap gap-2">
        {['continue_straight', 'turn_left', 'turn_right', 'arrive'].map((type) => (
          <button
            key={type}
            onClick={() => vibrateForInstruction(type)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs
                       text-white rounded-lg transition-colors"
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {['waypoint_arrival', 'journey_complete', 'flight_alert', 'warning'].map((type) => (
          <button
            key={type}
            onClick={() => vibrateForEvent(type)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs
                       text-white rounded-lg transition-colors"
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}
