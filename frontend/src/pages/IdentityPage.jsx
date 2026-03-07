import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { issueToken, getMyFlights } from '../api/client'
import FaceEnroll from '../components/Identity/FaceEnroll'
import DocumentForm from '../components/Identity/DocumentForm'
import TokenCard from '../components/Identity/TokenCard'

const STEPS = ['Face Enrollment', 'Travel Document', 'Issue Token']

export default function IdentityPage() {
  const navigate = useNavigate()
  const { biometricId, documentId, setVerificationToken } = useStore()
  const [step, setStep] = useState(0)
  const [flights, setFlights] = useState([])
  const [selectedFlight, setSelectedFlight] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState(null)

  // Auto-advance step based on existing state
  useEffect(() => {
    if (biometricId && step === 0) setStep(1)
    if (documentId && step === 1) setStep(2)
  }, [biometricId, documentId, step])

  // Load subscribed flights when on step 3
  useEffect(() => {
    if (step === 2) {
      getMyFlights()
        .then(({ data }) => {
          setFlights(data)
          if (data.length > 0) setSelectedFlight(data[0].flight_number)
        })
        .catch(() => {})
    }
  }, [step])

  const handleIssueToken = async () => {
    if (!selectedFlight) return
    setIssuing(true)
    setError(null)
    try {
      const { data } = await issueToken(selectedFlight)
      setVerificationToken(data)
      setStep(3) // Show token card
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to issue token')
    } finally {
      setIssuing(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-900 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/map')}
          className="text-slate-400 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-white">Digital Identity</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              i < step ? 'bg-green-600 text-white' :
              i === step ? 'bg-blue-600 text-white' :
              'bg-slate-700 text-slate-400'
            }`}>
              {i < step ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-0.5 mx-1 ${
                i < step ? 'bg-green-600' : 'bg-slate-700'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step label */}
      <h2 className="text-center text-sm text-slate-400 mb-6">
        {step < 3 ? STEPS[step] : 'Verification Active'}
      </h2>

      {/* Step content */}
      <div className="max-w-sm mx-auto">
        {step === 0 && (
          <FaceEnroll onComplete={() => setStep(1)} />
        )}

        {step === 1 && (
          <DocumentForm onComplete={() => setStep(2)} />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Select Flight</label>
              {flights.length > 0 ? (
                <select
                  value={selectedFlight}
                  onChange={(e) => setSelectedFlight(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600
                             rounded-lg text-sm text-white focus:outline-none
                             focus:ring-2 focus:ring-blue-500/50"
                >
                  {flights.map((f) => (
                    <option key={f.id} value={f.flight_number}>
                      {f.flight_number} - {f.status}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  <input
                    value={selectedFlight}
                    onChange={(e) => setSelectedFlight(e.target.value)}
                    placeholder="Enter flight number (e.g. EK204)"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600
                               rounded-lg text-sm text-white placeholder-slate-400
                               focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    No subscribed flights. Enter a flight number manually.
                  </p>
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleIssueToken}
              disabled={!selectedFlight || issuing}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500
                         disabled:bg-slate-700 text-white rounded-xl
                         font-medium transition-colors"
            >
              {issuing ? 'Issuing...' : 'Issue Verification Token'}
            </button>
          </div>
        )}

        {step >= 3 && (
          <div className="space-y-4">
            <TokenCard />
            <button
              onClick={() => navigate('/map')}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600
                         text-white rounded-xl font-medium transition-colors"
            >
              Back to Map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
