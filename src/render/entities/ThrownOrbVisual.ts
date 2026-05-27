import * as THREE from 'three'
import gsap from 'gsap'
import type { VisualAdapter } from './VisualAdapter'
import type { Obstacle } from '../../entities/Obstacle'
import type { ThrownOrb } from '../../entities/ThrownOrb'

export class ThrownOrbVisual implements VisualAdapter {
  private group: THREE.Group
  private sphere: THREE.Mesh
  private sphereMaterial: THREE.MeshStandardMaterial
  private trail: THREE.Line
  private trailPoints: THREE.Vector3[] = []
  private prevResult: string | null = null

  constructor() {
    this.group = new THREE.Group()

    this.sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x66b8ff,
      emissive: 0x2255aa,
      emissiveIntensity: 1.2,
      roughness: 0.15,
      metalness: 0.45,
      transparent: true,
      opacity: 1,
    })

    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 24), this.sphereMaterial)
    this.group.add(this.sphere)

    const trailGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0x99d8ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    })
    this.trail = new THREE.Line(trailGeometry, trailMaterial)
    this.group.add(this.trail)
  }

  sync(obstacle: Obstacle, _canvasW: number, _canvasH: number): void {
    const orb = obstacle as Obstacle & ThrownOrb
    const scale = obstacle.baseWidth > 0 ? obstacle.width / obstacle.baseWidth : 1
    const cx = obstacle.x + obstacle.width / 2
    const cy = -(obstacle.y + obstacle.height / 2)
    const cz = -obstacle.z

    this.group.position.set(cx, cy, cz)
    this.group.scale.set(scale, scale, scale)
    this.sphere.rotation.x += 0.14
    this.sphere.rotation.y += 0.18

    this.trailPoints.push(new THREE.Vector3(cx, cy, cz))
    while (this.trailPoints.length > 10) this.trailPoints.shift()
    if (this.trailPoints.length >= 2) {
      this.trail.geometry.dispose()
      this.trail.geometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints)
    }

    if (orb.result && orb.result !== this.prevResult) {
      if (orb.result === 'success') {
        this.playImpact()
      } else if (orb.result === 'fail') {
        this.playFade()
      }
      this.prevResult = orb.result
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.group)
  }

  dispose(): void {
    this.sphere.geometry.dispose()
    this.sphereMaterial.dispose()
    this.trail.geometry.dispose()
    ;(this.trail.material as THREE.Material).dispose()
  }

  private playImpact(): void {
    gsap.to(this.sphereMaterial, {
      emissiveIntensity: 3,
      opacity: 0,
      duration: 0.22,
      ease: 'power2.out',
    })
    gsap.to(this.group.scale, {
      x: this.group.scale.x * 1.6,
      y: this.group.scale.y * 1.6,
      z: this.group.scale.z * 1.6,
      duration: 0.2,
      ease: 'power2.out',
    })
  }

  private playFade(): void {
    gsap.to(this.sphereMaterial, {
      opacity: 0,
      duration: 0.25,
    })
  }
}
