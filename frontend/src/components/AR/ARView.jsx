import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store'
import InstructionBanner from '../Navigation/InstructionBanner'
import ETABar from '../Navigation/ETABar'

/**
 * WebXR immersive-ar session with Three.js.
 *
 * Session features requested: 'hit-test', 'dom-overlay'.
 * Reference space: 'local' (relative to device at session start).
 *
 * Each frame:
 *   1. Read current route instruction bearing from store.
 *   2. Compute relative bearing = instruction.bearing_deg - position.heading_deg.
 *   3. Rotate arrow mesh around Y axis to face that bearing.
 *   4. Translate arrow 1.5 m in front of camera (in view space).
 *   5. Render scene into XR session.
 *
 * Fallback: camera feed + 2D canvas compass arrow.
 */
// TODO(prod): WebXR arrows are camera-relative, not world-anchored.
// Production needs SLAM/LiDAR mapping pass.
export default function ARView({ onExit }) {
  const canvasRef  = useRef(null)
  const sessionRef = useRef(null)
  const videoRef   = useRef(null)
  const fallbackRef = useRef(false)
  const { position, route, currentStepIndex } = useStore()

  useEffect(() => {
    let renderer, scene, camera, arrowMesh, xrSession
    let animFrameId

    const buildScene = () => {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true,
        antialias: true,
      })
      renderer.xr.enabled = true
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(window.innerWidth, window.innerHeight)

      scene  = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 100)

      // Direction arrow: cone pointing forward
      const geo = new THREE.ConeGeometry(0.05, 0.25, 8)
      const mat = new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x003366 })
      arrowMesh = new THREE.Mesh(geo, mat)
      arrowMesh.rotation.z = -Math.PI / 2
      scene.add(arrowMesh)
      scene.add(new THREE.AmbientLight(0xffffff, 2))
    }

    const startXR = async () => {
      buildScene()
      xrSession = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.getElementById('ar-overlay') },
      })
      sessionRef.current = xrSession
      renderer.xr.setReferenceSpaceType('local')
      await renderer.xr.setSession(xrSession)
      xrSession.addEventListener('end', onExit)

      renderer.setAnimationLoop((_, frame) => {
        if (!frame) return
        const instructions = useStore.getState().route?.instructions
        const stepIdx = useStore.getState().currentStepIndex
        const pos = useStore.getState().position
        if (instructions?.[stepIdx]) {
          const bearing = instructions[stepIdx].bearing_deg
          const rel = ((bearing - pos.heading_deg) + 360) % 360
          arrowMesh.rotation.y = THREE.MathUtils.degToRad(-rel)
          const dir = new THREE.Vector3(0, 0, -1.5).applyEuler(camera.rotation)
          arrowMesh.position.copy(camera.position).add(dir)
        }
        renderer.render(scene, camera)
      })
    }

    const startFallback = async () => {
      fallbackRef.current = true
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      } catch (err) {
        console.error('Camera not available for AR fallback:', err)
      }

      // Draw compass arrow on canvas
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      const drawFrame = () => {
        const instructions = useStore.getState().route?.instructions
        const stepIdx = useStore.getState().currentStepIndex
        const pos = useStore.getState().position

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (instructions?.[stepIdx]) {
          const bearing = instructions[stepIdx].bearing_deg || 0
          const rel = ((bearing - (pos.heading_deg || 0)) + 360) % 360
          const radians = (rel * Math.PI) / 180

          const cx = canvas.width / 2
          const cy = canvas.height / 2

          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(radians)

          // Arrow body
          ctx.beginPath()
          ctx.moveTo(0, -60)
          ctx.lineTo(-20, 20)
          ctx.lineTo(0, 10)
          ctx.lineTo(20, 20)
          ctx.closePath()
          ctx.fillStyle = 'rgba(56, 189, 248, 0.8)'
          ctx.fill()
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
          ctx.lineWidth = 2
          ctx.stroke()

          ctx.restore()

          // Distance text
          const dist = instructions[stepIdx].distance_m
          if (dist != null) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)'
            ctx.font = 'bold 18px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(`${Math.round(dist)}m`, cx, cy + 80)
          }
        }

        animFrameId = requestAnimationFrame(drawFrame)
      }

      drawFrame()
    }

    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then((ok) => {
        ok ? startXR() : startFallback()
      })
    } else {
      startFallback()
    }

    return () => {
      cancelAnimationFrame(animFrameId)
      sessionRef.current?.end()
      renderer?.dispose()
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video feed for fallback mode */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div
        id="ar-overlay"
        className="absolute inset-0 pointer-events-none flex flex-col
                   justify-between p-4 z-10"
      >
        <div className="pointer-events-auto">
          <InstructionBanner />
        </div>
        <div className="pointer-events-auto mb-16">
          <ETABar />
        </div>
      </div>
      <button
        onClick={() => {
          sessionRef.current?.end()
          if (onExit) onExit()
        }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20
                   bg-white/20 backdrop-blur-sm text-white px-6 py-3
                   rounded-full pointer-events-auto border border-white/20
                   hover:bg-white/30 transition-colors"
      >
        Exit AR
      </button>
    </div>
  )
}
