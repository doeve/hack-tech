import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Standalone Three.js scene manager for XR.
 * Creates renderer, scene, camera. Manages animation loop and resize.
 * Used by ARView when WebXR is available.
 */
export default function XRScene({ onSceneReady, children }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.xr.enabled = true
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.01,
      100
    )
    camera.position.set(0, 1.6, 0)

    scene.add(new THREE.AmbientLight(0xffffff, 1.5))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(5, 10, 5)
    scene.add(dirLight)

    sceneRef.current = { renderer, scene, camera }

    if (onSceneReady) {
      onSceneReady({ renderer, scene, camera })
    }

    const handleResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    // Default animation loop (non-XR)
    const animate = () => {
      renderer.render(scene, camera)
    }
    renderer.setAnimationLoop(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.setAnimationLoop(null)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [onSceneReady])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    >
      {children}
    </div>
  )
}


