import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'
import { useFaceAPI } from '../../hooks/useFaceAPI'
import { useStore } from '../../store'
import { enrollFace } from '../../api/client'


export default function FaceEnroll({ onComplete }) {
  const webcamRef = useRef(null)
  const { loaded, captureDescriptor } = useFaceAPI()
  const { setBiometricId } = useStore()
  const [status, setStatus] = useState('idle') 
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
        liveness_score: 0.9,
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
    <div className="flex flex-col items-center gap-6">
      <div className="relative rounded-full overflow-hidden border-4 border-aviation w-64 h-64 bg-coolWhite shadow-md">
        {status !== 'success' && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
            className="w-full h-full object-cover scale-x-[-1]"
          />
        )}
        
        {}
        {status === 'success' && (
          <div className="w-full h-full bg-successMint/20 flex items-center justify-center">
            <div className="text-center animate-in fade-in zoom-in duration-300">
              <svg className="w-16 h-16 text-aviation mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-aviation mt-2 font-bold text-xs uppercase tracking-widest">Face enrolled</p>
            </div>
          </div>
        )}

        {}
        {status === 'capturing' && (
          <div className="absolute inset-0 bg-aviation/40 backdrop-blur-sm flex items-center justify-center">
            <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full" />
          </div>
        )}

        {}
        {status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-48 border-2 border-dashed border-aviation/30 rounded-full" />
          </div>
        )}
      </div>

      <div className="text-center space-y-2">
        {!loaded && (
          <p className="text-aviation font-bold text-[10px] animate-pulse uppercase tracking-tighter">
            Loading face recognition models...
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 p-2 rounded-lg">
            <p className="text-red-600 text-[11px] font-medium">{error}</p>
          </div>
        )}

        <div className="pt-2">
          {status !== 'success' && (
            <button
              onClick={handleCapture}
              disabled={!loaded || status === 'capturing'}
              className="px-10 py-3 bg-aviation hover:bg-aviation/90 disabled:bg-gray-200
                         disabled:text-gray-400 text-white rounded-full font-bold text-xs
                         uppercase tracking-widest transition-all shadow-md active:scale-95"
            >
              {status === 'capturing' ? 'Processing...' : 'Capture Face'}
            </button>
          )}
        </div>
      </div>

      <footer className="max-w-[240px]">
        <p className="text-[9px] text-gray-400 text-center uppercase tracking-tight leading-relaxed">
          Biometric descriptors are computed locally via TensorFlow.js. 
          Raw images never leave your device.
        </p>
      </footer>
    </div>
  )
}