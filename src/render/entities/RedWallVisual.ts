import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import gsap from 'gsap'
import type { VisualAdapter } from './VisualAdapter'
import type { Obstacle } from '../../entities/Obstacle'

const DEPTH = 40
const RADIUS = 15
const SEGMENTS = 4

interface RedWallExtra {
  inHitZone: boolean
}

export class RedWallVisual implements VisualAdapter {
  private group: THREE.Group
  private wallMesh: THREE.Mesh
  private shadowMesh: THREE.Mesh
  private wallMaterial: THREE.MeshStandardMaterial
  private spawnPlayed = false
  private prevInHitZone = false
  private prevResult: string | null = null

  constructor(width: number, height: number) {
    this.group = new THREE.Group()

    // Wall material — shiny red plastic
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xff2244,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.15,
    })

    // Rounded box geometry for chunky toy look
    const geometry = new RoundedBoxGeometry(width, height, DEPTH, SEGMENTS, RADIUS)
    this.wallMesh = new THREE.Mesh(geometry, this.wallMaterial)
    this.group.add(this.wallMesh)

    // Shadow plane beneath the wall
    const shadowGeo = new THREE.PlaneGeometry(width * 0.9, height * 0.95)
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
    })
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
    this.group.add(this.shadowMesh)
  }

  sync(obstacle: Obstacle, _canvasW: number, _canvasH: number): void {
    const extra = obstacle as Obstacle & RedWallExtra

    // Perspective ratio from projected width vs base width
    const perspScale = obstacle.baseWidth > 0 ? obstacle.width / obstacle.baseWidth : 1

    // Update material based on proximity state
    if (extra.inHitZone) {
      this.wallMaterial.opacity = 0.5
      this.wallMaterial.color.set(0xff2244)
    } else if (obstacle.width > 1) {
      this.wallMaterial.opacity = 0.25
    } else {
      this.wallMaterial.opacity = 0.15
    }

    // Position the group in screen space, then scale the local mesh for perspective.
    // Keeping position on the group avoids scaling the screen coordinates toward the origin.
    const cx = obstacle.x + obstacle.width / 2
    const cy = -(obstacle.y + obstacle.height / 2)
    const cz = -obstacle.z
    this.group.position.set(cx, cy, cz)
    this.wallMesh.position.set(0, 0, 0)

    // Shadow slightly behind and below
    this.shadowMesh.position.set(0, 8 * perspScale, -5)

    // Spawn bounce animation (once) — target is perspScale
    if (!this.spawnPlayed) {
      this.spawnPlayed = true
      this.group.scale.set(0.1, 0.1, 0.1)
      gsap.to(this.group.scale, {
        x: perspScale, y: perspScale, z: perspScale,
        duration: 0.4,
        ease: 'back.out(1.7)',
      })
    } else {
      this.group.scale.set(perspScale, perspScale, perspScale)
    }

    // Hit zone entry animation
    if (extra.inHitZone && !this.prevInHitZone) {
      this.wallMaterial.opacity = 0.5
    }
    this.prevInHitZone = extra.inHitZone

    // Result animations (trigger once)
    if (obstacle.result && obstacle.result !== this.prevResult) {
      if (obstacle.result === 'fail') {
        this.playHitFlash()
      } else if (obstacle.result === 'success') {
        this.playSuccessSlide()
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
    this.wallMesh.geometry.dispose()
    this.wallMaterial.dispose()
    this.shadowMesh.geometry.dispose()
    ;(this.shadowMesh.material as THREE.Material).dispose()
  }

  private playHitFlash(): void {
    // White emissive flash
    gsap.to(this.wallMaterial, {
      emissiveIntensity: 1.0,
      duration: 0.1,
      onUpdate: () => {
        this.wallMaterial.emissive.set(0xffffff)
      },
      onComplete: () => {
        gsap.to(this.wallMaterial, {
          emissiveIntensity: 0,
          duration: 0.3,
          ease: 'power2.out',
        })
      },
    })
  }

  private playSuccessSlide(): void {
    gsap.to(this.group.scale, {
      x: 0.8,
      y: 0.8,
      z: 0.8,
      duration: 0.3,
      ease: 'power2.in',
    })
    gsap.to(this.wallMaterial, {
      opacity: 0,
      duration: 0.3,
    })
  }
}
