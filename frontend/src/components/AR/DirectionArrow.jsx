import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * 3D arrow mesh for navigation direction.
 * - Cone geometry pointing in navigation direction
 * - Color-coded: blue for straight, yellow for turn
 * - Optional distance text label
 *
 * Props:
 *   scene     - Three.js scene to add arrow to
 *   bearing   - absolute bearing in degrees
 *   heading   - user's current heading in degrees
 *   distance  - distance to next waypoint (metres)
 *   turnType  - 'straight' | 'left' | 'right' | 'slight_left' | 'slight_right'
 */
export default function DirectionArrow({ scene, bearing, heading, distance, turnType }) {
  const meshRef = useRef(null)
  const labelRef = useRef(null)

  useEffect(() => {
    if (!scene) return

    // Choose color based on turn type
    let color = 0x38bdf8 // blue for straight
    if (turnType === 'left' || turnType === 'right') {
      color = 0xfbbf24 // yellow for turns
    } else if (turnType === 'slight_left' || turnType === 'slight_right') {
      color = 0x67e8f9 // light cyan for slight turns
    }

    // Arrow geometry
    const geo = new THREE.ConeGeometry(0.06, 0.3, 8)
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color).multiplyScalar(0.3),
      transparent: true,
      opacity: 0.9,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.z = -Math.PI / 2 // Point forward (along Z)
    scene.add(mesh)
    meshRef.current = mesh

    // Distance label (simple sprite)
    if (distance != null) {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.roundRect(0, 0, 128, 64, 8)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${Math.round(distance)}m`, 64, 32)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(0.3, 0.15, 1)
      sprite.position.set(0, -0.25, 0)
      mesh.add(sprite)
      labelRef.current = sprite
    }

    return () => {
      scene.remove(mesh)
      geo.dispose()
      mat.dispose()
    }
  }, [scene, turnType, distance])

  // Update rotation based on bearing/heading
  useEffect(() => {
    if (!meshRef.current) return
    const rel = (((bearing || 0) - (heading || 0)) + 360) % 360
    meshRef.current.rotation.y = THREE.MathUtils.degToRad(-rel)
  }, [bearing, heading])

  return null
}


