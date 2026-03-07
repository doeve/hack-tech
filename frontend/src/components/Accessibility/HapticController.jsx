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

    // Scale pattern durations by intensity
    const intensity = accessProfile.haptic_intensity || 1.0
    const scaled = Array.isArray(pattern)
      ? pattern.map((v) => Math.round(v * intensity))
      : [Math.round(pattern * intensity)]

    navigator.vibrate(scaled)
  }, [accessProfile])

  const vibrateForInstruction = useCallback((instructionType) => {
    const patterns = {
      continue_straight: [100],
      turn_left: [200, 100, 200],
      turn_right: [200, 100, 200, 100, 200],
      turn_slight_left: [150, 100, 150],
      turn_slight_right: [150, 100, 150, 100, 150],
      arrive: [300, 100, 300, 100, 300],
    }
    vibrate(patterns[instructionType] || [100])
  }, [vibrate])

  return { vibrate, vibrateForInstruction }
}

export default function HapticController() {
  const { vibrate, vibrateForInstruction } = useHapticController()

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
        Haptic Test
      </p>
      <div className="flex flex-wrap gap-2">
        {['continue_straight', 'turn_left', 'turn_right', 'arrive'].map((type) => (
          <button
            key={type}
            onClick={() => vibrateForInstruction(type)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-600 text-xs
                       text-slate-900 rounded-lg transition-colors"
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
    </div>
  )
}


