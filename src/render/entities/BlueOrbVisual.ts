import * as THREE from 'three'
import gsap from 'gsap'
import type { VisualAdapter } from './VisualAdapter'
import type { Obstacle } from '../../entities/Obstacle'
import { ORB_LIFETIME_SEC } from '../../config/gameConfig'

const ORB_RADIUS = 35
const RING_INNER = 42
const RING_OUTER = 50
const RING_SEGMENTS = 32

export class BlueOrbVisual implements VisualAdapter {
  private group: THREE.Group
  private sphereMesh: THREE.Mesh
  private sphereMaterial: THREE.MeshStandardMaterial
  private ringMesh: THREE.Mesh
  private ringMaterial: THREE.MeshBasicMaterial
  private spawnPlayed = false
  private prevResult: string | null = null
  private localTime = 0

  constructor() {
    this.group = new THREE.Group()

    // Metallic blue sphere
    this.sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x2288ff,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 1.0,
    })

    const sphereGeo = new THREE.SphereGeometry(ORB_RADIUS, 32, 32)
    this.sphereMesh = new THREE.Mesh(sphereGeo, this.sphereMaterial)
    this.group.add(this.sphereMesh)

    // Glow ring around the orb
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    })

    const ringGeo = new THREE.RingGeometry(RING_INNER, RING_OUTER, RING_SEGMENTS)
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMaterial)
    this.ringMesh.position.z = 1 // slightly in front
    this.group.add(this.ringMesh)
  }

  sync(obstacle: Obstacle, _canvasW: number, _canvasH: number): void {
    this.localTime += 0.016
    const orb = obstacle as Obstacle & { interactionState?: string }

    // Match the shared world-Z projection used by the other V2 obstacles.
    const perspScale = obstacle.baseWidth > 0 ? obstacle.width / obstacle.baseWidth : 1

    // Position by projected screen center.
    const cx = obstacle.x + obstacle.width / 2
    const cy = -(obstacle.y + obstacle.height / 2)
    const cz = -obstacle.z
    this.group.position.set(cx, cy, cz)

    // Float/bob animation
    this.sphereMesh.position.y = Math.sin(this.localTime * 3) * 6
    this.ringMesh.position.y = Math.sin(this.localTime * 3) * 6

    // Rotate ring slowly
    this.ringMesh.rotation.z += 0.01

    // Fade out as lifetime progresses
    const lifetimeRatio = Math.min(this.localTime / ORB_LIFETIME_SEC, 1)
    const fadeAlpha = lifetimeRatio > 0.83 // last ~0.5s of 3s
      ? 1 - (lifetimeRatio - 0.83) / 0.17
      : 1

    this.sphereMaterial.opacity = fadeAlpha
    this.ringMaterial.opacity = 0.4 * fadeAlpha
    if (orb.interactionState === 'candidate') {
      this.ringMaterial.opacity = Math.max(this.ringMaterial.opacity, 0.75)
      this.ringMaterial.color.set(0xbde7ff)
    } else if (orb.interactionState === 'grabbed') {
      this.ringMaterial.opacity = 0.85
      this.ringMaterial.color.set(0xffffff)
    } else {
      this.ringMaterial.color.set(0x4488ff)
    }

    // Ring pulses faster as lifetime decreases
    const pulseSpeed = 3 + lifetimeRatio * 8
    const pulseScale = 1 + Math.sin(this.localTime * pulseSpeed) * 0.08
    this.ringMesh.scale.set(pulseScale, pulseScale, 1)

    // Emissive glow increases as orb ages
    this.sphereMaterial.emissive = new THREE.Color(0x1144aa)
    this.sphereMaterial.emissiveIntensity = 0.3 + lifetimeRatio * 0.5

    // Spawn animation — target is zScale, not 1
    if (!this.spawnPlayed) {
      this.spawnPlayed = true
      this.group.scale.set(0.1, 0.1, 0.1)
      gsap.to(this.group.scale, {
        x: perspScale, y: perspScale, z: perspScale,
        duration: 0.35,
        ease: 'back.out(2)',
      })
    } else {
      // Continuously update scale based on z-depth
      this.group.scale.set(perspScale, perspScale, perspScale)
    }

    // Result animations (trigger once)
    if (obstacle.result && obstacle.result !== this.prevResult) {
      if (obstacle.result === 'success') {
        this.playTouchBurst()
      } else if (obstacle.result === 'fail') {
        this.playMissPoof()
      }
      this.prevResult = obstacle.result
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.group)
  }

  dispose(): void {
    this.sphereMesh.geometry.dispose()
    this.sphereMaterial.dispose()
    this.ringMesh.geometry.dispose()
    this.ringMaterial.dispose()
  }

  private playTouchBurst(): void {
    // Bright flash then shrink
    gsap.to(this.sphereMaterial, {
      emissiveIntensity: 2.0,
      duration: 0.1,
      onComplete: () => {
        gsap.to(this.group.scale, {
          x: 1.5, y: 1.5, z: 1.5,
          duration: 0.15,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(this.group.scale, {
              x: 0, y: 0, z: 0,
              duration: 0.2,
              ease: 'power2.in',
            })
            gsap.to(this.sphereMaterial, {
              opacity: 0,
              duration: 0.2,
            })
          },
        })
      },
    })
  }

  private playMissPoof(): void {
    // Shrink to zero with fade
    gsap.to(this.group.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.3,
      ease: 'power3.in',
    })
    gsap.to(this.sphereMaterial, {
      opacity: 0,
      duration: 0.3,
    })
    gsap.to(this.ringMaterial, {
      opacity: 0,
      duration: 0.2,
    })
  }
}
