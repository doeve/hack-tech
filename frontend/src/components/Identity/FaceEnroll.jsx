import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useFaceAPI } from '../../hooks/useFaceAPI'
import { useStore } from '../../store'
import { enrollFace } from '../../api/client'

export default function FaceEnroll({ onComplete }) {
  const webcamRef = useRef(null)
  const { loaded, captureDescriptor } = useFaceAPI()
  const { setBiometricId } = useStore()
  const [status, setStatus] = useState('idle') // idle | capturing | success | error
  const [error, setError] = useState(null)

  const handleCapture = useCallback(async () => {
    if (!webcamRef.current || !loaded) return
    setStatus('capturing')
    setError(null)

    try {
      const video = webcamRef.current.video
      const result = await captureDescriptor(video)

      if (!result) {
        setError('No face detected. Please ensure your face is clearly visible.')
        setStatus('error')
        return
      }

      const { data } = await enrollFace({
        face_descriptor: result.descriptor,
        quality_score: result.score,
        liveness_score: 0.9, // TODO(prod): active liveness challenge needed
      })

      setBiometricId(data.biometric_id)
      setStatus('success')
      if (onComplete) onComplete(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Enrollment failed')
      setStatus('error')
    }
  }, [loaded, captureDescriptor, setBiometricId, onComplete])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 w-full max-w-sm aspect-[4/3]">
        {status !== 'success' && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
            className="w-full h-full object-cover"
          />
        )}
        {status === 'success' && (
          <div className="w-full h-full bg-green-900/30 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-400 mt-2 font-medium">Face enrolled</p>
            </div>
          </div>
        )}
        {status === 'capturing' && (
          <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#1e3a8a] border-t-transparent rounded-full" />
          </div>
        )}
        {/* Face guide overlay */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-56 border-2 border-dashed border-[#1e3a8a]/50 rounded-full" />
          </div>
        )}
      </div>

      {!loaded && (
        <p className="text-slate-500 text-sm">Loading face recognition models...</p>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {status !== 'success' && (
        <button
          onClick={handleCapture}
          disabled={!loaded || status === 'capturing'}
          className="px-6 py-2.5 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 disabled:bg-slate-100
                     disabled:text-slate-500 text-white rounded-xl font-medium
                     transition-colors"
        >
          {status === 'capturing' ? 'Processing...' : 'Capture Face'}
        </button>
      )}
    </div>
  )
}


