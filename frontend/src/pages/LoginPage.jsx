import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { login, register } from '../api/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setAuth } = useStore()
  const redirectTo = location.state?.from?.pathname || '/map'
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState({
    username: '',
    password: '',
    display_name: '',
    nationality_code: '',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isRegister) {
        const { data } = await register(form)
        setAuth({ id: data.user_id, user_id: data.user_id }, data.access_token)
      } else {
        const { data } = await login(form.username, form.password)
        setAuth(
          { id: data.user_id, user_id: data.user_id, ...data.user },
          data.access_token
        )
      }
      navigate(redirectTo)
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-sm">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#1e3a8a] rounded-2xl flex items-center
                          justify-center mx-auto mb-4 shadow-lg shadow-blue-900/20">
            <svg className="w-8 h-8 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">SkyGuide</h1>
          <p className="text-slate-500 text-sm mt-1">Indoor navigation & digital identity</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Username"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200
                         rounded-xl text-slate-900 placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]/50"
            />
          </div>
          <div>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Password"
              required
              className="w-full px-4 py-3 bg-white border border-slate-200
                         rounded-xl text-slate-900 placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]/50"
            />
          </div>

          {isRegister && (
            <>
              <div>
                <input
                  name="display_name"
                  value={form.display_name}
                  onChange={handleChange}
                  placeholder="Display Name"
                  className="w-full px-4 py-3 bg-white border border-slate-200
                             rounded-xl text-slate-900 placeholder-slate-500
                             focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]/50"
                />
              </div>
              <div>
                <input
                  name="nationality_code"
                  value={form.nationality_code}
                  onChange={handleChange}
                  placeholder="Nationality Code (e.g. GB)"
                  maxLength={2}
                  className="w-full px-4 py-3 bg-white border border-slate-200
                             rounded-xl text-slate-900 placeholder-slate-500
                             focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]/50"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 disabled:bg-slate-100
                       text-white rounded-xl font-medium transition-colors
                       shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(null) }}
            className="text-[#1e3a8a] hover:text-blue-300 text-sm transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
          </button>
        </div>

        {/* Quick demo login hint */}
        <div className="mt-6 p-3 bg-white rounded-xl border border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            Demo: username <span className="text-slate-500 font-mono">demo</span> / password{' '}
            <span className="text-slate-500 font-mono">hackathon2024</span>
          </p>
        </div>
      </div>
    </div>
  )
}


