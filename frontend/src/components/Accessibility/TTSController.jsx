import { useCallback, useRef } from 'react'
import { useStore } from '../../store'

/**
 * Text-to-speech controller using the Web Speech API.
 * Provides speak/stop plus high-level announce helpers for navigation events.
 */
export function useTTS() {
  const { accessProfile } = useStore()
  const lastSpokenRef = useRef('')
  const lastSpokenAtRef = useRef(0)

  const speak = useCallback((text, { force = false, interrupt = true } = {}) => {
    if (!accessProfile.tts_enabled) return
    if (!('speechSynthesis' in window)) return
    if (!text) return

    // Debounce: don't repeat the same text within 3 seconds (unless forced)
    const now = Date.now()
    if (!force && text === lastSpokenRef.current && now - lastSpokenAtRef.current < 3000) return
    lastSpokenRef.current = text
    lastSpokenAtRef.current = now

    if (interrupt) window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = accessProfile.tts_speed || 1.0
    utterance.lang = 'en-US'

    if (accessProfile.tts_voice && accessProfile.tts_voice !== 'default') {
      const voices = window.speechSynthesis.getVoices()
      const match = voices.find((v) => v.name.includes(accessProfile.tts_voice))
      if (match) utterance.voice = match
    }

    window.speechSynthesis.speak(utterance)
  }, [accessProfile])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
  }, [])

  // --- High-level navigation announcers ---

  const announceInstruction = useCallback((instruction) => {
    if (!instruction) return
    const text = instruction.tts_text || instruction.display_text
    if (text) speak(text)
  }, [speak])

  const announceWaypointArrival = useCallback((poiName, nextPoiName) => {
    let text = `Arrived at ${poiName}.`
    if (nextPoiName) text += ` Next stop: ${nextPoiName}.`
    speak(text, { force: true })
  }, [speak])

  const announceJourneyComplete = useCallback((gateName) => {
    const text = gateName
      ? `Journey complete. You have arrived at ${gateName}. Have a great flight!`
      : `Journey complete. You have arrived at your gate.`
    speak(text, { force: true })
  }, [speak])

  const announceFlightApproaching = useCallback((flight, countdown) => {
    const dest = flight.destination_city || flight.destination_code || 'your destination'
    const gate = flight.gate || 'your gate'
    speak(
      `Upcoming flight. ${flight.flight_number} to ${dest} departs in ${countdown} from Gate ${gate}. Slide to begin your journey.`,
      { force: true }
    )
  }, [speak])

  const announceFlightStatus = useCallback((flightNumber, status) => {
    const readable = status?.replace(/_/g, ' ')
    speak(`Flight ${flightNumber} is now ${readable}.`)
  }, [speak])

  return {
    speak, stop,
    announceInstruction,
    announceWaypointArrival,
    announceJourneyComplete,
    announceFlightApproaching,
    announceFlightStatus,
  }
}

export default function TTSController() {
  const { speak, stop } = useTTS()

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
        TTS Test
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => speak('Continue straight for 50 metres towards Gate B12.', { force: true })}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs
                     text-white rounded-lg transition-colors"
        >
          Navigation
        </button>
        <button
          onClick={() => speak('Arrived at Security checkpoint. Next stop: Passport Control.', { force: true })}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs
                     text-white rounded-lg transition-colors"
        >
          Arrival
        </button>
        <button
          onClick={() => speak('Journey complete. You have arrived at Gate B12. Have a great flight!', { force: true })}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs
                     text-white rounded-lg transition-colors"
        >
          Complete
        </button>
        <button
          onClick={stop}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs
                     text-white rounded-lg transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  )
}
