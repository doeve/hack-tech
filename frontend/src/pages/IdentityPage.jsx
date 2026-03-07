import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../store'
import { getMyFlights, subscribeFlight, getFlights } from '../api/client'
import FaceEnroll from '../components/Identity/FaceEnroll'
import FaceVerify from '../components/Identity/FaceVerify'
import DocumentForm from '../components/Identity/DocumentForm'
import BottomNav from '../components/BottomNav'

export default function IdentityPage() {
  const location = useLocation()
  const {
    biometricId, documentId,
    faceVerifiedThisSession, setFaceVerifiedThisSession,
  } = useStore()

  const [showEnroll, setShowEnroll] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [myFlights, setMyFlights] = useState([])
  const [scanResult, setScanResult] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auto-open scanner if navigated with scan intent
  useEffect(() => {
    if (location.state?.openScanner && faceVerifiedThisSession) {
      setShowScanner(true)
    }
  }, [location.state, faceVerifiedThisSession])

  // Load my flights
  useEffect(() => {
    const load = () => getMyFlights()
      .then(({ data }) => { setMyFlights(data || []); setLoading(false) })
      .catch(() => setLoading(false))
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const faceEnrolled = !!biometricId
  const hasDocument = !!documentId

  const handleFaceVerified = () => {
    setFaceVerifiedThisSession(true)
    if (location.state?.openScanner) {
      setShowScanner(true)
    }
  }

  const handleSkipForDemo = () => {
    setFaceVerifiedThisSession(true)
    if (location.state?.openScanner) {
      setShowScanner(true)
    }
  }

  const handleScanSuccess = async (flightData) => {
    try {
      await subscribeFlight(flightData.flight_id)
      const { data } = await getMyFlights()
      setMyFlights(data || [])
      setScanResult({ ok: true, flight: flightData.flight_number })
    } catch {
      setScanResult({ ok: false, message: 'Failed to add flight' })
    }
    setShowScanner(false)
  }

  const formatTime = (dt) => {
    if (!dt) return '--:--'
    return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Face gate â€” shown on first access in session
  if (!faceVerifiedThisSession) {
    return (
      <div className="min-h-full bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-[#1e3a8a]/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Identity Verification</h2>
            <p className="text-sm text-slate-500">
              {faceEnrolled
                ? 'Verify your face to access your digital identity this session'
                : 'Enroll your face to create your secure digital identity'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            {faceEnrolled ? (
              <FaceVerify onResult={handleFaceVerified} />
            ) : (
              <FaceEnroll onComplete={handleFaceVerified} />
            )}
          </div>

          <button onClick={handleSkipForDemo}
            className="w-full mt-4 py-2.5 text-sm text-slate-500 hover:text-slate-500 transition-colors">
            Skip for demo
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  // Main identity view â€” after face verification
  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <Header />

      {/* Scan result toast */}
      {scanResult && (
        <div className={`mx-5 mb-4 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
          scanResult.ok
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          <span>{scanResult.ok ? `Added ${scanResult.flight} to My Flights` : scanResult.message}</span>
          <button onClick={() => setScanResult(null)} className="hover:text-slate-900 ml-2">&times;</button>
        </div>
      )}

      {/* Scan Ticket Button */}
      <div className="px-5 mb-5">
        <button
          onClick={() => setShowScanner(true)}
          className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-600/15 to-cyan-600/15 border border-[#1e3a8a]/25 rounded-2xl hover:from-blue-600/25 hover:to-cyan-600/25 transition-all"
        >
          <div className="w-12 h-12 bg-[#1e3a8a]/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-[#1e3a8a]">Scan Ticket QR</p>
            <p className="text-xs text-slate-500">Scan boarding pass to add flight</p>
          </div>
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* My Flights */}
      <div className="px-5 mb-5">
        <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-3">My Flights</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-[#1e3a8a] border-t-transparent rounded-full" />
          </div>
        ) : myFlights.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-slate-500 text-sm">No flights added yet</p>
            <p className="text-slate-600 text-xs mt-1">Scan a ticket QR code to add your flight</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myFlights.map((f) => (
              <BoardingPassCard key={f.id} flight={f} formatTime={formatTime} />
            ))}
          </div>
        )}
      </div>

      {/* Biometric Status */}
      <div className="px-5 mb-5">
        <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-3">Biometric Status</h2>
        <button
          onClick={() => !faceEnrolled && setShowEnroll(true)}
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
            faceEnrolled
              ? 'bg-green-500/5 border-green-500/20'
              : 'bg-white border-slate-200 hover:bg-white'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            faceEnrolled ? 'bg-green-500/15' : 'bg-slate-100'
          }`}>
            <svg className={`w-6 h-6 ${faceEnrolled ? 'text-green-400' : 'text-slate-500'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {faceEnrolled ? 'Face Enrolled' : 'Enroll Face'}
              </p>
              {faceEnrolled && (
                <span className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {faceEnrolled ? 'Active for seamless boarding' : 'Tap to start face enrollment'}
            </p>
          </div>
        </button>
      </div>

      {/* Session Verification Status */}
      <div className="px-5 mb-5">
        <div className="flex items-center gap-3 p-3.5 bg-[#1e3a8a]/5 border border-[#1e3a8a]/20 rounded-xl">
          <div className="w-10 h-10 bg-[#1e3a8a]/10 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">Session Verified</p>
            <p className="text-xs text-slate-500">Face verified for this session</p>
          </div>
          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-green-500/20 text-green-400">Active</span>
        </div>
      </div>

      {/* Verified Documents */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Verified Documents</h2>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => !hasDocument && setShowDocForm(true)}
            className="w-full flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl hover:bg-white transition-colors"
          >
            <div className="w-10 h-10 bg-[#1e3a8a]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-slate-900">Passport (International)</p>
              <p className="text-xs text-slate-500">Expires: 12 Nov 2028</p>
            </div>
            {hasDocument ? (
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-green-500/20 text-green-400">Verified</span>
            ) : (
              <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-[#1e3a8a]/20 text-[#1e3a8a]">Add</span>
            )}
          </button>

          <div className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl">
            <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">E-Visa (United States)</p>
              <p className="text-xs text-slate-500">Destination Requirement</p>
            </div>
            <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-red-500/20 text-red-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
              </svg>
              Required
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEnroll && (
        <Modal title="Face Enrollment" onClose={() => setShowEnroll(false)}>
          <FaceEnroll onComplete={() => setShowEnroll(false)} />
        </Modal>
      )}

      {showDocForm && (
        <Modal title="Travel Document" onClose={() => setShowDocForm(false)}>
          <DocumentForm onComplete={() => setShowDocForm(false)} />
        </Modal>
      )}

      {showScanner && (
        <QRScannerModal
          onScan={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      <BottomNav />
    </div>
  )
}

/* â”€â”€â”€ Subcomponents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function Header() {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#1e3a8a] rounded-lg flex items-center justify-center">
          <svg className="w-4.5 h-4.5 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>
      <h1 className="text-lg font-bold text-slate-900">Digital Identity</h1>
      <button className="relative text-slate-500 hover:text-slate-900 p-1">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/70" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 border border-slate-200 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function BoardingPassCard({ flight, formatTime }) {
  const [showQR, setShowQR] = useState(false)

  const STATUS_COLORS = {
    boarding: 'bg-[#1e3a8a]/20 text-[#1e3a8a]',
    final_call: 'bg-orange-500/20 text-orange-400',
    delayed: 'bg-red-500/20 text-red-400',
    scheduled: 'bg-green-500/20 text-green-400',
    departed: 'bg-cyan-500/20 text-cyan-400',
    cancelled: 'bg-red-500/20 text-red-400',
    arrived: 'bg-green-500/20 text-green-400',
  }

  const qrData = JSON.stringify({
    type: 'skyguide_ticket',
    flight_id: flight.id,
    flight_number: flight.flight_number,
    origin_code: flight.origin_code,
    destination_code: flight.destination_code,
    gate: flight.gate,
    terminal: flight.terminal,
    scheduled_at: flight.scheduled_at,
  })

  return (
    <>
      <div onClick={() => setShowQR(true)}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:bg-white transition-colors">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">SkyGuide Flight</p>
              <p className="text-xl font-bold text-slate-900">{flight.flight_number}</p>
            </div>
            <div className="text-right">
              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${STATUS_COLORS[flight.status] || STATUS_COLORS.scheduled}`}>
                {flight.status?.replace(/_/g, ' ') || 'Scheduled'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{flight.origin_code || '--'}</p>
            </div>
            <div className="flex-1 px-4 flex items-center">
              <div className="flex-1 h-px bg-slate-600" />
              <svg className="w-5 h-5 text-slate-500 mx-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
              </svg>
              <div className="flex-1 h-px bg-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{flight.destination_code || '--'}</p>
            </div>
          </div>
        </div>

        <div className="relative my-1">
          <div className="border-t border-dashed border-slate-200" />
          <div className="absolute -left-3 -top-3 w-6 h-6 bg-slate-50 rounded-full" />
          <div className="absolute -right-3 -top-3 w-6 h-6 bg-slate-50 rounded-full" />
        </div>

        <div className="px-4 py-3 flex items-center gap-4">
          <div className="flex-1 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Time</p>
              <p className="text-sm font-bold text-slate-900">{formatTime(flight.scheduled_at)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Gate</p>
              <p className="text-sm font-bold text-[#1e3a8a]">{flight.gate || '--'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Terminal</p>
              <p className="text-sm font-bold text-slate-900">{flight.terminal || '--'}</p>
            </div>
          </div>
          <div className="flex-shrink-0 text-slate-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
        </div>
      </div>

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowQR(false)}>
          <div className="absolute inset-0 bg-slate-900/80" />
          <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4 p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowQR(false)} className="absolute top-3 right-3 text-slate-500 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Boarding Pass</p>
            <p className="text-2xl font-bold text-slate-900 mb-1">{flight.flight_number}</p>
            <p className="text-sm text-slate-500 mb-4">
              {flight.origin_code || '--'} â†’ {flight.destination_code || '--'}
            </p>

            <div className="bg-slate-50 rounded-xl p-4 mb-4 inline-block">
              <QRCodeSVG value={qrData} size={200} level="M" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-left mb-2">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Gate</p>
                <p className="text-sm font-bold text-slate-900">{flight.gate || '--'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Terminal</p>
                <p className="text-sm font-bold text-slate-900">{flight.terminal || '--'}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Time</p>
                <p className="text-sm font-bold text-slate-900">{formatTime(flight.scheduled_at)}</p>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 mt-3">Present this QR at the boarding gate</p>
          </div>
        </div>
      )}
    </>
  )
}

function QRScannerModal({ onScan, onClose }) {
  const scannerRef = useRef(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState(null)
  const [manualId, setManualId] = useState('')

  useEffect(() => {
    let running = false
    let stopped = false
    const scanner = new Html5Qrcode('qr-reader')

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => {
            if (stopped) return
            try {
              const data = JSON.parse(text)
              if (data.type === 'skyguide_ticket' && data.flight_id) {
                stopped = true
                scanner.stop().then(() => { running = false }).catch(() => {})
                onScanRef.current(data)
              }
            } catch {
              // Not a valid SkyGuide QR
            }
          },
          () => {}
        )
        running = true
      } catch {
        setError('Camera access denied or unavailable')
      }
    }

    startScanner()

    return () => {
      stopped = true
      if (running) {
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  const handleManualAdd = () => {
    if (manualId.trim()) {
      onScan({ flight_id: manualId.trim(), flight_number: 'Manual', type: 'skyguide_ticket' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/90" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm mx-4 p-5 border border-slate-200">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-slate-900 z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Scan Ticket QR</h3>
          <p className="text-sm text-slate-500">Point camera at boarding pass QR code</p>
        </div>

        <div className="rounded-xl overflow-hidden bg-slate-900 mb-4" style={{ minHeight: 280 }}>
          <div id="qr-reader" ref={scannerRef} />
        </div>

        {error && (
          <>
            <p className="text-red-400 text-sm text-center mb-3">{error}</p>
            <div className="space-y-2">
              <p className="text-xs text-slate-500 text-center">Enter flight ID manually:</p>
              <div className="flex gap-2">
                <input
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="Flight ID"
                  className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]/30/50"
                />
                <button onClick={handleManualAdd}
                  className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white text-sm rounded-lg transition-colors">
                  Add
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


