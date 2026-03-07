import { useEffect, useState } from 'react'
import * as faceapi from 'face-api.js'

const MODEL_URL = '/models'

export function useFaceAPI() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => setLoaded(true))
  }, [])

  const captureDescriptor = async (videoEl) => {
    const det = await faceapi
      .detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!det) return null
    return { descriptor: Array.from(det.descriptor), score: det.detection.score }
  }

  const matchDescriptor = (stored, live, threshold = 0.6) => {
    const dist = faceapi.euclideanDistance(new Float32Array(stored), new Float32Array(live))
    return { match: dist < threshold, distance: dist }
  }

  return { loaded, captureDescriptor, matchDescriptor }
}
