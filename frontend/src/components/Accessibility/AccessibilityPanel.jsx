import { useState } from 'react'
import { useStore } from '../../store'
import { updateAccessProfile } from '../../api/client'
import HapticController from './HapticController'
import TTSController from './TTSController'

export default function AccessibilityPanel({ onClose, isStep = false }) {
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
      if (onClose) onClose()
    } catch (err) {
      console.error('Failed to save accessibility profile:', err)
    } finally {
      setSaving(false)
    }
  }

<<<<<<< HEAD
  const Toggle = ({ label, sublabel, checked, onChange }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <span className="text-xs font-bold text-aviation uppercase tracking-wider block">{label}</span>
        <span className="text-[10px] text-gray-400 block">{sublabel}</span>
      </div>
      <button
        onClick={onChange}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-successMint' : 'bg-gray-200'
=======
  const Toggle = ({ label, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-500">{label}</span>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-[#1e3a8a]' : 'bg-slate-600'
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'left-7' : 'left-1'
        }`} />
      </button>
    </div>
  )

  const containerClasses = isStep 
    ? "w-full space-y-4" 
    : "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"

  return (
<<<<<<< HEAD
    <div className={containerClasses}>
      {!isStep && <div className="absolute inset-0 bg-aviation/20 backdrop-blur-sm" onClick={onClose} />}
      
      <div className={`relative bg-white rounded-2xl w-full sm:max-w-md overflow-hidden shadow-2xl border border-gray-100 ${isStep ? '' : 'max-h-[85vh] flex flex-col'}`}>
        
        {}
        <div className="bg-coolWhite p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-aviation uppercase tracking-tight">User Preferences</h2>
            <p className="text-[10px] text-gray-400 uppercase">Accessibility & Navigation</p>
          </div>
          {!isStep && (
            <button onClick={onClose} className="text-gray-400 hover:text-aviation transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
=======
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md
                      max-h-[80vh] overflow-y-auto border border-slate-200 shadow-2xl">
        <div className="sticky top-0 bg-white p-4 border-b border-slate-200
                        flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Accessibility</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
        </div>

        {}
        <div className="p-6 space-y-6 overflow-y-auto">
          <Toggle 
            label="Haptic Feedback" 
            sublabel="Directional vibrations for wayfinding"
            checked={accessProfile.haptics_enabled}
            onChange={() => handleToggle('haptics_enabled')} 
          />

          {accessProfile.haptics_enabled && (
<<<<<<< HEAD
            <div className="pl-2 animate-in slide-in-from-left-2">
              <div className="flex justify-between mb-2">
                <label className="text-[10px] font-bold text-aviation uppercase">Intensity</label>
                <span className="text-[10px] font-mono text-aviation">{Math.round(accessProfile.haptic_intensity * 100)}%</span>
              </div>
=======
            <div className="pl-2">
              <label className="text-xs text-slate-500">Intensity</label>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
              <input
                type="range" min="0" max="2" step="0.1"
                value={accessProfile.haptic_intensity}
                onChange={(e) => handleSlider('haptic_intensity', e.target.value)}
                className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-aviation"
              />
            </div>
          )}

          <Toggle 
            label="Text-to-Speech" 
            sublabel="Voice-guided airport instructions"
            checked={accessProfile.tts_enabled}
            onChange={() => handleToggle('tts_enabled')} 
          />

          <Toggle 
            label="AR Navigation" 
            sublabel="Visual 3D arrows in camera view"
            checked={accessProfile.ar_enabled}
            onChange={() => handleToggle('ar_enabled')} 
          />

          <Toggle 
            label="Avoid Stairs" 
            sublabel="Routes using elevators and ramps"
            checked={accessProfile.avoid_stairs}
            onChange={() => handleToggle('avoid_stairs')} 
          />

<<<<<<< HEAD
          {}
          <HapticController />
          <TTSController />
=======
          <div className="border-t border-slate-200 pt-4">
            <HapticController />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <TTSController />
          </div>
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a

          <button
            onClick={handleSave}
            disabled={saving}
<<<<<<< HEAD
            className="w-full py-4 bg-aviation hover:bg-aviation/90 text-white
                       rounded-xl font-bold text-xs uppercase tracking-widest 
                       transition-all shadow-md disabled:bg-gray-200"
=======
            className="w-full py-2.5 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white
                       rounded-xl font-medium transition-colors disabled:bg-slate-100"
>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
          >
            {saving ? 'Syncing Profile...' : 'Save & Continue'}
          </button>
        </div>
        
        <footer className="bg-coolWhite p-3 text-center border-t border-gray-100">
           <p className="text-[9px] text-gray-400 uppercase tracking-tighter">
             Preferences are linked to your biometric PDI profile
           </p>
        </footer>
      </div>
    </div>
  )
<<<<<<< HEAD
}
=======
}


>>>>>>> e44b1bcd2c85ab5743b7c33318a4717761529c2a
