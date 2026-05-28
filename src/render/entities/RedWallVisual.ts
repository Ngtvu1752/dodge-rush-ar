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
  resultCause?: 'dodge' | 'projectile' | 'touch'
}

export class RedWallVisual implements VisualAdapter {
  private group: THREE.Group
  private wallMesh: THREE.Mesh
  private shadowMesh: THREE.Mesh
  private wallMaterial: THREE.MeshStandardMaterial
  private shardGroup: THREE.Group
  private shardMaterials: THREE.MeshStandardMaterial[] = []
  private crackFlash: THREE.Mesh
  private crackMaterial: THREE.MeshBasicMaterial
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

    this.shardGroup = new THREE.Group()
    this.shardGroup.visible = false
    for (let i = 0; i < 6; i++) {
      const shardMaterial = new THREE.MeshStandardMaterial({
        color: 0xff5a6e,
        emissive: 0xffd6dc,
        emissiveIntensity: 0,
        roughness: 0.3,
        metalness: 0.08,
        transparent: true,
        opacity: 0,
      })
      const shard = new THREE.Mesh(
        new RoundedBoxGeometry(width * (0.14 + i * 0.01), height * 0.16, DEPTH * 0.28, 2, 6),
        shardMaterial,
      )
      this.shardGroup.add(shard)
      this.shardMaterials.push(shardMaterial)
    }
    this.group.add(this.shardGroup)

    this.crackMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.crackFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(width * 0.92, height * 0.92),
      this.crackMaterial,
    )
    this.crackFlash.position.set(0, 0, DEPTH * 0.54)
    this.group.add(this.crackFlash)

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
        if (extra.resultCause === 'projectile') {
          this.playProjectileBreak()
        } else {
          this.playSuccessSlide()
        }
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
    for (const child of this.shardGroup.children) {
      const mesh = child as THREE.Mesh
      mesh.geometry.dispose()
    }
    for (const material of this.shardMaterials) {
      material.dispose()
    }
    this.crackFlash.geometry.dispose()
    this.crackMaterial.dispose()
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
    gsap.killTweensOf(this.group.position)
    gsap.to(this.group.scale, {
      x: 0.76,
      y: 0.76,
      z: 0.8,
      duration: 0.28,
      ease: 'power2.inOut',
    })
    gsap.to(this.group.position, {
      y: this.group.position.y + 18,
      duration: 0.28,
      ease: 'power2.out',
    })
    gsap.to(this.wallMaterial, {
      opacity: 0,
      duration: 0.26,
    })
  }

  private playProjectileBreak(): void {
    gsap.killTweensOf(this.group.scale)
    gsap.killTweensOf(this.wallMaterial)

    this.shardGroup.visible = true
    this.wallMaterial.emissive.set(0xffffff)
    this.crackMaterial.opacity = 0.9

    gsap.to(this.wallMaterial, {
      emissiveIntensity: 1.6,
      opacity: 0,
      duration: 0.2,
      ease: 'power2.out',
    })

    gsap.to(this.group.scale, {
      x: 1.08,
      y: 0.82,
      z: 0.86,
      duration: 0.18,
      ease: 'power2.out',
    })
    gsap.to(this.crackMaterial, {
      opacity: 0,
      duration: 0.16,
      ease: 'power1.out',
    })

    this.shardGroup.children.forEach((child, index) => {
      const shard = child as THREE.Mesh
      const material = shard.material as THREE.MeshStandardMaterial
      const angle = -0.9 + index * 0.36
      shard.position.set(0, 0, 0)
      shard.rotation.set(0, 0, 0)
      material.opacity = 0.95
      material.emissiveIntensity = 1.1

      gsap.to(shard.position, {
        x: Math.cos(angle) * 150,
        y: Math.sin(angle) * 90,
        z: (Math.random() - 0.5) * 40,
        duration: 0.26,
        ease: 'power3.out',
      })
      gsap.to(shard.rotation, {
        x: 0.6 + index * 0.08,
        y: -0.4 + index * 0.05,
        z: angle * 0.8,
        duration: 0.24,
        ease: 'power2.out',
      })
      gsap.to(material, {
        opacity: 0,
        emissiveIntensity: 0,
        duration: 0.28,
        ease: 'power2.out',
      })
    })
  }
}
