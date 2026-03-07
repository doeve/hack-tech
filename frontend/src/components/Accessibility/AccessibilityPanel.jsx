import { useState } from 'react'
import { useStore } from '../../store'
import { updateAccessProfile } from '../../api/client'
import HapticController from './HapticController'
import TTSController from './TTSController'

export default function AccessibilityPanel({ onClose }) {
  const { accessProfile, setAccessProfile } = useStore()
  const [saving, setSaving] = useState(false)

  const handleToggle = (key) => {
    setAccessProfile({ ...accessProfile, [key]: !accessProfile[key] })
  }

  const handleSlider = (key, value) => {
    setAccessProfile({ ...accessProfile, [key]: parseFloat(value) })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateAccessProfile(accessProfile)
    } catch (err) {
      console.error('Failed to save accessibility profile:', err)
    } finally {
      setSaving(false)
    }
  }

  const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-blue-500' : 'bg-slate-600'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md
                      max-h-[80vh] overflow-y-auto border border-slate-700 shadow-2xl">
        <div className="sticky top-0 bg-slate-800 p-4 border-b border-slate-700
                        flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Accessibility</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <Toggle label="Haptic Feedback" checked={accessProfile.haptics_enabled}
            onChange={() => handleToggle('haptics_enabled')} />

          {accessProfile.haptics_enabled && (
            <div className="pl-2">
              <label className="text-xs text-slate-400">Intensity</label>
              <input
                type="range" min="0" max="2" step="0.1"
                value={accessProfile.haptic_intensity}
                onChange={(e) => handleSlider('haptic_intensity', e.target.value)}
                className="w-full accent-blue-500"
              />
            </div>
          )}

          <Toggle label="Text-to-Speech" checked={accessProfile.tts_enabled}
            onChange={() => handleToggle('tts_enabled')} />

          <Toggle label="AR Navigation" checked={accessProfile.ar_enabled}
            onChange={() => handleToggle('ar_enabled')} />

          <Toggle label="Avoid Stairs" checked={accessProfile.avoid_stairs}
            onChange={() => handleToggle('avoid_stairs')} />

          <div className="border-t border-slate-700 pt-4">
            <HapticController />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <TTSController />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white
                       rounded-xl font-medium transition-colors disabled:bg-slate-700"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
