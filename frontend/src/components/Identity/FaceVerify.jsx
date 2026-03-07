import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useFaceAPI } from '../../hooks/useFaceAPI'
import { useStore } from '../../store'
import { getFaceDescriptor, verifyAtTouchpoint } from '../../api/client'

export default function FaceVerify({ touchpointId, onResult }) {
  const webcamRef = useRef(null)
  const { loaded, captureDescriptor, matchDescriptor } = useFaceAPI()
  const { user, verificationToken } = useStore()
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleVerify = useCallback(async () => {
    if (!webcamRef.current || !loaded || !user) return
    setStatus('verifying')
    setError(null)

    try {
      // 1. Capture live descriptor from camera
      const video = webcamRef.current.video
      const live = await captureDescriptor(video)
      if (!live) {
        setError('No face detected. Please try again.')
        setStatus('error')
        return
      }

      // 2. Fetch stored descriptor
      const { data: stored } = await getFaceDescriptor(user.id || user.user_id)

      // 3. Match on-device
      const match = matchDescriptor(stored.face_descriptor, live.descriptor)

      // 4. If we have a token, verify at the touchpoint
      if (verificationToken?.token && touchpointId) {
        const { data: verifyResult } = await verifyAtTouchpoint(touchpointId, {
          token_jwt: verificationToken.token,
          match_score: match.distance,
        })
        setResult({
          ...match,
          outcome: verifyResult.outcome,
          claims: verifyResult.claims,
        })
      } else {
        setResult(match)
      }

      setStatus('done')
      if (onResult) onResult({ ...match })
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed')
      setStatus('error')
    }
  }, [loaded, user, verificationToken, touchpointId, captureDescriptor, matchDescriptor, onResult])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 w-full max-w-sm aspect-[4/3]">
        <Webcam
          ref={webcamRef}
          audio={false}
          videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
          className="w-full h-full object-cover"
        />
        {status === 'verifying' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {result && (
        <div className={`p-3 rounded-xl text-center w-full max-w-sm ${
          result.match ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
        }`}>
          <p className={`font-medium ${result.match ? 'text-green-400' : 'text-red-400'}`}>
            {result.match ? 'Identity Verified' : 'No Match'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Distance: {result.distance?.toFixed(4)} | Threshold: 0.6
          </p>
          {result.outcome && (
            <p className="text-xs text-slate-300 mt-1">
              Touchpoint: {result.outcome}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        onClick={handleVerify}
        disabled={!loaded || status === 'verifying'}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700
                   text-white rounded-xl font-medium transition-colors"
      >
        {status === 'verifying' ? 'Verifying...' : 'Verify Identity'}
      </button>
    </div>
  )
}
