import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import FaceEnroll from '../components/Identity/FaceEnroll'

const STEPS = ['Welcome', 'Biometrics', 'Document']

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { setOnboardingComplete, setDocumentId } = useStore()
  const [step, setStep] = useState(0)

  const finish = () => {
    setOnboardingComplete(true)
    navigate('/flights', { replace: true })
  }

  return (
    <div className="min-h-full bg-[#0b1120] flex flex-col">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 pt-6 pb-2">
        {STEPS.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
            i === step ? 'w-8 bg-blue-500' : i < step ? 'w-4 bg-blue-500/40' : 'w-4 bg-slate-700'
          }`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col">
        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
        {step === 1 && <BiometricStep onNext={() => setStep(2)} onSkip={() => setStep(2)} />}
        {step === 2 && <DocumentStep onFinish={finish} setDocumentId={setDocumentId} />}
      </div>
    </div>
  )
}

/* ─── Step 0: Welcome ──────────────────────────────────────────── */
function WelcomeStep({ onNext }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
        <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M21 16v-2l-8-5V3.5a1.5 1.5 0 00-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Welcome to SkyGuide</h1>
      <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-2">
        Your personal airport companion. We'll guide you through check-in, security, and all the way to your gate.
      </p>
      <p className="text-slate-500 text-xs leading-relaxed max-w-xs mb-10">
        First, let's set up your digital identity for a seamless airport experience.
      </p>

      <button onClick={onNext}
        className="w-full max-w-xs py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-semibold text-base transition-colors shadow-lg shadow-blue-600/20">
        Get Started
      </button>
    </div>
  )
}

/* ─── Step 1: Biometric (Face Enrollment) ──────────────────────── */
function BiometricStep({ onNext, onSkip }) {
  return (
    <div className="flex-1 flex flex-col px-6 pt-6">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-blue-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Biometric Identity</h2>
        <p className="text-sm text-slate-400">
          Enroll your face for hands-free verification at security, lounges, and boarding gates.
        </p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/30 rounded-2xl p-5 mb-4">
        <FaceEnroll onComplete={onNext} />
      </div>

      <button onClick={onSkip} className="py-2.5 text-sm text-slate-500 hover:text-slate-400 transition-colors">
        Skip for now
      </button>
    </div>
  )
}

/* ─── Step 2: Document — select type, scan/photo, mock verify ──── */
function DocumentStep({ onFinish, setDocumentId }) {
  const [docType, setDocType] = useState(null) // null | 'passport' | 'national_id'
  const [phase, setPhase] = useState('choose') // choose | capture | verifying | verified

  const handleSelect = (type) => {
    setDocType(type)
    setPhase('capture')
  }

  const handleCaptured = useCallback(() => {
    setPhase('verifying')
    setTimeout(() => {
      setPhase('verified')
      setDocumentId(`mock_${docType}_${Date.now()}`)
      setTimeout(onFinish, 1200)
    }, 2000)
  }, [docType, setDocumentId, onFinish])

  const handleSkipCapture = useCallback(() => {
    // Skip photo but still mock-approve
    setPhase('verifying')
    setTimeout(() => {
      setPhase('verified')
      setDocumentId(`mock_${docType}_${Date.now()}`)
      setTimeout(onFinish, 1200)
    }, 1500)
  }, [docType, setDocumentId, onFinish])

  if (phase === 'verified') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Document Verified</h2>
        <p className="text-sm text-slate-400">{docType === 'passport' ? 'Passport' : 'National ID'} approved</p>
      </div>
    )
  }

  if (phase === 'verifying') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="animate-spin w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full mb-4" />
        <h2 className="text-lg font-bold text-white mb-1">Verifying Document</h2>
        <p className="text-sm text-slate-400">Checking {docType === 'passport' ? 'passport' : 'national ID'}...</p>
      </div>
    )
  }

  if (phase === 'capture') {
    return <DocumentCapture docType={docType} onCaptured={handleCaptured} onSkip={handleSkipCapture} onBack={() => setPhase('choose')} />
  }

  // phase === 'choose'
  return (
    <div className="flex-1 flex flex-col px-6 pt-6">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-amber-500/15 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Travel Document</h2>
        <p className="text-sm text-slate-400">Select your identification type</p>
      </div>

      <div className="space-y-3 mb-6">
        <button onClick={() => handleSelect('passport')}
          className="w-full flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/30 rounded-2xl hover:bg-slate-800 hover:border-blue-500/30 transition-all">
          <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-semibold">Passport</p>
            <p className="text-xs text-slate-500">International travel document</p>
          </div>
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button onClick={() => handleSelect('national_id')}
          className="w-full flex items-center gap-4 p-5 bg-slate-800/50 border border-slate-700/30 rounded-2xl hover:bg-slate-800 hover:border-blue-500/30 transition-all">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <p className="text-white font-semibold">National ID</p>
            <p className="text-xs text-slate-500">Government-issued identification</p>
          </div>
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <button onClick={onFinish} className="py-2.5 text-sm text-slate-500 hover:text-slate-400 transition-colors">
        Skip for now
      </button>
    </div>
  )
}

/* ─── Document photo capture (camera) ──────────────────────────── */
function DocumentCapture({ docType, onCaptured, onSkip, onBack }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [captured, setCaptured] = useState(null) // data URL
  const [cameraError, setCameraError] = useState(false)

  useEffect(() => {
    let active = true
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => { if (active) setCameraError(true) })
    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const handleRetake = () => {
    setCaptured(null)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch(() => setCameraError(true))
  }

  const label = docType === 'passport' ? 'Passport' : 'National ID'

  return (
    <div className="flex-1 flex flex-col px-6 pt-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-bold text-white">Scan {label}</h3>
        <div className="w-5" />
      </div>

      <p className="text-sm text-slate-400 text-center mb-4">
        Take a photo of your {label.toLowerCase()} — make sure all details are visible
      </p>

      {cameraError ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm mb-4">Camera not available</p>
          <button onClick={onSkip}
            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl font-medium transition-colors">
            Continue without photo
          </button>
        </div>
      ) : captured ? (
        <div className="flex-1 flex flex-col">
          <div className="relative rounded-2xl overflow-hidden bg-black mb-4 flex-1">
            <img src={captured} alt="Captured document" className="w-full h-full object-contain" />
            {/* Decorative document frame overlay */}
            <div className="absolute inset-4 border-2 border-dashed border-white/20 rounded-xl pointer-events-none" />
          </div>
          <div className="flex gap-3 mb-4">
            <button onClick={handleRetake}
              className="flex-1 py-3 bg-slate-800 border border-slate-700/50 text-slate-300 rounded-xl font-medium text-sm transition-colors hover:bg-slate-700">
              Retake
            </button>
            <button onClick={onCaptured}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium text-sm transition-colors shadow-lg shadow-blue-600/20">
              Use Photo
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="relative rounded-2xl overflow-hidden bg-black mb-4 flex-1">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {/* Document frame guide */}
            <div className="absolute inset-4 border-2 border-dashed border-white/30 rounded-xl pointer-events-none" />
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="text-[10px] text-white/50 bg-black/50 px-3 py-1 rounded-full">
                Align document within frame
              </span>
            </div>
          </div>
          <button onClick={handleCapture}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-semibold text-sm transition-colors shadow-lg shadow-blue-600/20 mb-3">
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Capture
            </span>
          </button>
          <button onClick={onSkip} className="py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors">
            Skip photo
          </button>
        </div>
      )}
    </div>
  )
}
