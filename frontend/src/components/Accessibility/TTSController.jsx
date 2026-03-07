import { useCallback } from 'react'
import { useStore } from '../../store'

/**
 * Text-to-speech controller using the Web Speech API.
 */
export function useTTS() {
  const { accessProfile } = useStore()

  const speak = useCallback((text) => {
    if (!accessProfile.tts_enabled) return
    if (!('speechSynthesis' in window)) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = accessProfile.tts_speed || 1.0
    utterance.lang = 'en-US'

    // Try to pick a specific voice if configured
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

  return { speak, stop }
}

export default function TTSController() {
  const { speak, stop } = useTTS()

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
        TTS Test
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => speak('Continue straight for 50 metres')}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-600 text-xs
                     text-slate-900 rounded-lg transition-colors"
        >
          Test Speech
        </button>
        <button
          onClick={stop}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-600 text-xs
                     text-slate-900 rounded-lg transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  )
}


