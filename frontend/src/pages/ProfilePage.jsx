import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { updateAccessProfile } from '../api/client'
import BottomNav from '../components/BottomNav'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, accessProfile, setAccessProfile, logout } = useStore()
  const [saving, setSaving] = useState(false)

  const displayName = user?.display_name || 'Captain Alex Reed'

  const handleToggle = async (key) => {
    const updated = { ...accessProfile, [key]: !accessProfile[key] }
    setAccessProfile(updated)
    try { await updateAccessProfile(updated) } catch {}
  }

  const handleSlider = async (key, value) => {
    const updated = { ...accessProfile, [key]: parseFloat(value) }
    setAccessProfile(updated)
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try { await updateAccessProfile(accessProfile) } catch {}
    finally { setSaving(false) }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-full bg-[#0b1120] pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Profile</h1>
        <button className="text-slate-400 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Avatar & Info */}
      <div className="flex flex-col items-center px-5 pt-4 pb-6">
        <div className="relative mb-4">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center overflow-hidden border-4 border-slate-700">
            <svg className="w-16 h-16 text-amber-200/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <span className="absolute bottom-1 right-1 w-5 h-5 bg-blue-500 rounded-full border-3 border-[#0b1120]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">{displayName}</h2>
        <p className="text-sm text-slate-400 mb-5">Elite Voyager | SkyGuide Member</p>

        <div className="flex gap-3 w-full max-w-xs">
          <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors">
            Edit Profile
          </button>
          <button className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl border border-slate-700 transition-colors">
            Stats
          </button>
        </div>
      </div>

      {/* Accessibility Settings */}
      <div className="px-5 mb-6">
        <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-4">
          Accessibility Settings
        </h3>

        <div className="space-y-1">
          <ToggleRow
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
            label="Haptic Feedback"
            subtitle="Vibration cues for turns, arrivals & alerts"
            checked={accessProfile.haptics_enabled}
            onChange={() => handleToggle('haptics_enabled')}
          />

          {accessProfile.haptics_enabled && (
            <div className="pl-12 pr-2 pb-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                <span>Light</span>
                <span>Strong</span>
              </div>
              <input
                type="range" min="0.3" max="2" step="0.1"
                value={accessProfile.haptic_intensity}
                onChange={(e) => handleSlider('haptic_intensity', e.target.value)}
                className="w-full accent-blue-500 h-1"
              />
            </div>
          )}

          <ToggleRow
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            }
            label="Voice Navigation"
            subtitle="Speaks directions, arrivals & flight alerts"
            checked={accessProfile.tts_enabled}
            onChange={() => handleToggle('tts_enabled')}
          />

          {accessProfile.tts_enabled && (
            <div className="pl-12 pr-2 pb-3">
              <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                <span>Slow</span>
                <span>Fast</span>
              </div>
              <input
                type="range" min="0.5" max="2" step="0.1"
                value={accessProfile.tts_speed || 1.0}
                onChange={(e) => handleSlider('tts_speed', e.target.value)}
                className="w-full accent-blue-500 h-1"
              />
            </div>
          )}
        </div>
      </div>

      {/* Account */}
      <div className="px-5 mb-6">
        <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-4">
          Account
        </h3>

        <div className="space-y-1">
          <AccountRow
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            label="Change Password"
          />
          <AccountRow
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            }
            label="Notification Settings"
          />
        </div>
      </div>

      {/* Demo Controls */}
      <div className="px-5 mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="w-full flex items-center gap-3 py-3.5 px-4 bg-purple-500/10 hover:bg-purple-500/15
                     border border-purple-500/20 text-purple-400 rounded-xl font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="flex-1 text-left">Mission Control</span>
          <svg className="w-4 h-4 text-purple-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Logout */}
      <div className="px-5 mb-6">
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20
                     text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Log Out
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-xs text-slate-600 pb-4">
        SkyGuide v2.4.1 — Elite Voyager Edition
      </p>

      <BottomNav />
    </div>
  )
}

function ToggleRow({ icon, label, subtitle, checked, onChange }) {
  return (
    <div className="flex items-center gap-3 py-3 px-1">
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{label}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <button
        onClick={onChange}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
          checked ? 'bg-blue-500' : 'bg-slate-600'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  )
}

function AccountRow({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 py-3.5 px-1 w-full hover:bg-slate-800/40 rounded-lg transition-colors"
    >
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span className="text-sm text-white font-medium flex-1 text-left">{label}</span>
      <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
