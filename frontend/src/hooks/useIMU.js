import { useEffect, useRef, useState, useCallback } from 'react'

const SAMPLE_RATE_MS = 50

export function useIMU() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const accelRef = useRef({ x: 0, y: 0, z: 0 })
  const gyroRef = useRef({ x: 0, y: 0, z: 0 })
  const headingRef = useRef(0)
  const [accel, setAccel] = useState({ x: 0, y: 0, z: 0 })
  const [gyro, setGyro] = useState({ x: 0, y: 0, z: 0 })
  const [heading, setHeading] = useState(0)

  const requestPermission = useCallback(async () => {
    // iOS 13+ requires explicit permission request triggered by user gesture
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const motionPerm = await DeviceMotionEvent.requestPermission()
        const orientPerm = await DeviceOrientationEvent.requestPermission()
        if (motionPerm === 'granted' && orientPerm === 'granted') {
          setPermissionGranted(true)
          return true
        }
        return false
      } catch {
        return false
      }
    }
    // Non-iOS: permission is implicit
    setPermissionGranted(true)
    return true
  }, [])

  useEffect(() => {
    const hasMotion = 'DeviceMotionEvent' in window
    const hasOrientation = 'DeviceOrientationEvent' in window
    setIsAvailable(hasMotion && hasOrientation)

    if (!hasMotion || !hasOrientation) return

    // Auto-grant on non-iOS
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
      setPermissionGranted(true)
    }
  }, [])

  useEffect(() => {
    if (!permissionGranted) return

    const handleMotion = (e) => {
      const a = e.accelerationIncludingGravity || {}
      const r = e.rotationRate || {}
      accelRef.current = {
        x: a.x ?? 0,
        y: a.y ?? 0,
        z: a.z ?? 0,
      }
      gyroRef.current = {
        x: r.alpha ?? 0,
        y: r.beta ?? 0,
        z: r.gamma ?? 0,
      }
    }

    const handleOrientation = (e) => {
      // alpha: compass heading (0-360), 0 = north
      // On most devices alpha is the compass direction the device is facing
      if (e.webkitCompassHeading !== undefined) {
        // iOS provides webkitCompassHeading as degrees from north
        headingRef.current = e.webkitCompassHeading
      } else if (e.alpha !== null) {
        // Android: alpha is 0 when pointing north, increases counter-clockwise
        // Convert to compass heading (clockwise from north)
        headingRef.current = (360 - e.alpha) % 360
      }
    }

    window.addEventListener('devicemotion', handleMotion, { passive: true })
    window.addEventListener('deviceorientation', handleOrientation, { passive: true })

    // Throttled state updates
    const interval = setInterval(() => {
      setAccel({ ...accelRef.current })
      setGyro({ ...gyroRef.current })
      setHeading(headingRef.current)
    }, SAMPLE_RATE_MS)

    return () => {
      window.removeEventListener('devicemotion', handleMotion)
      window.removeEventListener('deviceorientation', handleOrientation)
      clearInterval(interval)
    }
  }, [permissionGranted])

  return {
    accel,
    gyro,
    heading,
    isAvailable,
    permissionGranted,
    requestPermission,
  }
}
