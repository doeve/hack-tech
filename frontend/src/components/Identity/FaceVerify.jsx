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
    setResult(null)

    try {
      const video = webcamRef.current.video
      const live = await captureDescriptor(video)
      if (!live) {
        setError('No face detected. Please try again.')
        setStatus('error')
        return
      }
      const { data: stored } = await getFaceDescriptor(user.id || user.user_id)
      const match = matchDescriptor(stored.face_descriptor, live.descriptor)


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
    <div className="flex flex-col items-center gap-6">
      {}
      <div className="relative rounded-full overflow-hidden border-4 border-aviation w-64 h-64 bg-coolWhite shadow-md">
        <Webcam
          ref={webcamRef}
          audio={false}
          videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
          className="w-full h-full object-cover scale-x-[-1]"
        />
        
        {}
        {status === 'verifying' && (
          <div className="absolute inset-0 bg-aviation/40 backdrop-blur-sm flex items-center justify-center">
            <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full" />
          </div>
        )}

        {}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-48 border-2 border-dashed border-aviation/30 rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {}
      {result && (
        <div className={`p-4 rounded-2xl text-center w-full max-w-sm border-2 shadow-sm transition-all animate-in zoom-in duration-300 ${
          result.match ? 'bg-white border-successMint' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${result.match ? 'bg-successMint' : 'bg-red-500'}`} />
            <p className={`font-bold text-sm uppercase tracking-widest ${result.match ? 'text-aviation' : 'text-red-700'}`}>
              {result.match ? 'Identity Verified' : 'No Match'}
            </p>
          </div>
          
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-gray-400 font-mono uppercase">
              Distance: {result.distance?.toFixed(4)} | Threshold: 0.6
            </p>
            {result.outcome && (
              <p className="text-[10px] font-bold text-aviation uppercase tracking-tighter">
                Outcome: {result.outcome}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 p-3 rounded-xl w-full max-w-sm">
          <p className="text-red-600 text-xs font-medium text-center">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={!loaded || status === 'verifying'}
        className="px-10 py-3 bg-aviation hover:bg-aviation/90 disabled:bg-gray-200
                   disabled:text-gray-400 text-white rounded-full font-bold text-xs
                   uppercase tracking-widest transition-all shadow-md active:scale-95"
      >
        {status === 'verifying' ? 'Verifying...' : 'Verify Identity'}
      </button>

      <footer className="max-w-[260px]">
        <p className="text-[9px] text-gray-400 text-center uppercase tracking-tight leading-relaxed">
          Biometric comparison is performed locally. Match scores are sent to touchpoints for verification.
        </p>
      </footer>
    </div>
  )
}