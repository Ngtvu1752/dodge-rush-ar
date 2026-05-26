import * as THREE from 'three'
import gsap from 'gsap'
import type { VisualAdapter } from './VisualAdapter'
import type { Obstacle } from '../../entities/Obstacle'

const BEAM_DEPTH = 8
const BEAM_HEIGHT = 12
const SPARK_COUNT = 24

interface HighLaserExtra {
  inHitZone: boolean
}

export class HighLaserVisual implements VisualAdapter {
  private group: THREE.Group
  private beamMesh: THREE.Mesh
  private beamMaterial: THREE.MeshStandardMaterial
  private sparksGeometry: THREE.BufferGeometry
  private sparksMesh: THREE.Points
  private sparkPositions: Float32Array
  private sparkVelocities: Float32Array
  private spawnPlayed = false
  private prevInHitZone = false
  private prevResult: string | null = null
  private time = 0

  constructor(canvasWidth: number) {
    this.group = new THREE.Group()

    // Emissive orange beam material — picked up by bloom
    this.beamMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.2,
    })

    const geometry = new THREE.BoxGeometry(canvasWidth, BEAM_HEIGHT, BEAM_DEPTH)
    this.beamMesh = new THREE.Mesh(geometry, this.beamMaterial)
    this.group.add(this.beamMesh)

    // Spark particles around the beam
    this.sparkPositions = new Float32Array(SPARK_COUNT * 3)
    this.sparkVelocities = new Float32Array(SPARK_COUNT * 3)

    for (let i = 0; i < SPARK_COUNT; i++) {
      this.initSpark(i, canvasWidth)
    }

    this.sparksGeometry = new THREE.BufferGeometry()
    this.sparksGeometry.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3))

    const sparksMaterial = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.sparksMesh = new THREE.Points(this.sparksGeometry, sparksMaterial)
    this.group.add(this.sparksMesh)
  }

  private initSpark(i: number, canvasWidth: number): void {
    const i3 = i * 3
    this.sparkPositions[i3] = (Math.random() - 0.5) * canvasWidth * 0.8
    this.sparkPositions[i3 + 1] = (Math.random() - 0.5) * 20
    this.sparkPositions[i3 + 2] = (Math.random() - 0.5) * 15
    this.sparkVelocities[i3] = (Math.random() - 0.5) * 30
    this.sparkVelocities[i3 + 1] = (Math.random() - 0.5) * 30
    this.sparkVelocities[i3 + 2] = (Math.random() - 0.5) * 10
  }

  sync(obstacle: Obstacle, _canvasW: number, _canvasH: number): void {
    const extra = obstacle as Obstacle & HighLaserExtra
    this.time += 0.016 // ~60fps

    // Perspective ratio from projected width vs base width
    const perspScale = obstacle.baseWidth > 0 ? obstacle.width / obstacle.baseWidth : 1

    // Update material opacity based on proximity
    if (extra.inHitZone) {
      this.beamMaterial.opacity = 0.7
      this.beamMaterial.emissiveIntensity = 2.0 + Math.sin(this.time * 8) * 0.5
      ;(this.sparksMesh.material as THREE.PointsMaterial).opacity = 0.8
    } else if (obstacle.width > 1) {
      this.beamMaterial.opacity = 0.4
      this.beamMaterial.emissiveIntensity = 1.5
      ;(this.sparksMesh.material as THREE.PointsMaterial).opacity = 0.4
    } else {
      this.beamMaterial.opacity = 0.2
      this.beamMaterial.emissiveIntensity = 1.0
      ;(this.sparksMesh.material as THREE.PointsMaterial).opacity = 0.1
    }

    // Position beam at center using entity's projected screen-space values
    const cx = obstacle.x + obstacle.width / 2
    const cy = -(obstacle.y + obstacle.height / 2)
    const cz = -obstacle.z
    this.group.position.set(cx, cy, cz)

    // Update spark particles
    for (let i = 0; i < SPARK_COUNT; i++) {
      const i3 = i * 3
      this.sparkPositions[i3] += this.sparkVelocities[i3] * 0.016
      this.sparkPositions[i3 + 1] += this.sparkVelocities[i3 + 1] * 0.016
      this.sparkPositions[i3 + 2] += this.sparkVelocities[i3 + 2] * 0.016

      // Respawn if too far from center
      const dist = Math.abs(this.sparkPositions[i3]) + Math.abs(this.sparkPositions[i3 + 1])
      if (dist > 60) {
        this.sparkPositions[i3] = (Math.random() - 0.5) * 20
        this.sparkPositions[i3 + 1] = (Math.random() - 0.5) * 10
        this.sparkVelocities[i3] = (Math.random() - 0.5) * 30
        this.sparkVelocities[i3 + 1] = (Math.random() - 0.5) * 30
      }
    }
    this.sparksGeometry.attributes.position.needsUpdate = true

    // Spawn animation — target is perspScale
    if (!this.spawnPlayed) {
      this.spawnPlayed = true
      this.group.scale.set(perspScale, 0.1, 0.1)
      gsap.to(this.group.scale, {
        y: perspScale, z: perspScale,
        duration: 0.3,
        ease: 'back.out(1.5)',
      })
    } else {
      this.group.scale.set(perspScale, perspScale, perspScale)
    }

    // Hit zone entry
    if (extra.inHitZone && !this.prevInHitZone) {
      this.beamMaterial.opacity = 0.7
    }
    this.prevInHitZone = extra.inHitZone

    // Result animations
    if (obstacle.result && obstacle.result !== this.prevResult) {
      if (obstacle.result === 'fail') {
        this.playHitExplosion()
      } else if (obstacle.result === 'success') {
        this.playSuccessSplit()
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
    this.beamMesh.geometry.dispose()
    this.beamMaterial.dispose()
    this.sparksGeometry.dispose()
    ;(this.sparksMesh.material as THREE.Material).dispose()
  }

  private playHitExplosion(): void {
    // Flash white then fade
    gsap.to(this.beamMaterial, {
      emissiveIntensity: 4.0,
      duration: 0.1,
      onUpdate: () => {
        this.beamMaterial.emissive.set(0xffffff)
      },
      onComplete: () => {
        this.beamMaterial.emissive.set(0xff4400)
        gsap.to(this.beamMaterial, {
          emissiveIntensity: 0,
          opacity: 0,
          duration: 0.4,
          ease: 'power2.out',
        })
      },
    })
  }

  private playSuccessSplit(): void {
    // Beam slides apart — scale X down
    gsap.to(this.group.scale, {
      x: 0,
      duration: 0.3,
      ease: 'power2.in',
    })
    gsap.to(this.beamMaterial, {
      opacity: 0,
      duration: 0.3,
    })
  }
}
