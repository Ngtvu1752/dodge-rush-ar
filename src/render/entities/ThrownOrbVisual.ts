import * as THREE from 'three'
import gsap from 'gsap'
import type { VisualAdapter } from './VisualAdapter'
import type { Obstacle } from '../../entities/Obstacle'
import type { ThrownOrb } from '../../entities/ThrownOrb'

const MAX_TRAIL_POINTS = 20

export class ThrownOrbVisual implements VisualAdapter {
  private group: THREE.Group
  private sphere: THREE.Mesh
  private shell: THREE.Mesh
  private sphereMaterial: THREE.MeshStandardMaterial
  private shellMaterial: THREE.MeshBasicMaterial
  private trail: THREE.Line
  private trailPoints: THREE.Vector3[] = []
  private prevResult: string | null = null
  private pulseTime = 0

  constructor() {
    this.group = new THREE.Group()

    this.sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x7cc8ff,
      emissive: 0x3b8fff,
      emissiveIntensity: 2.2,
      roughness: 0.12,
      metalness: 0.5,
      transparent: true,
      opacity: 1,
    })

    this.shellMaterial = new THREE.MeshBasicMaterial({
      color: 0xb9e8ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })

    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(27, 24, 24), this.sphereMaterial)
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(38, 18, 18), this.shellMaterial)
    this.group.add(this.sphere)
    this.group.add(this.shell)

    const trailGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xa4e0ff,
      transparent: true,
      opacity: 0.95,
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

    const speed = Math.hypot(orb.velocityX, orb.velocityY, orb.velocityZ)
    const speedPulse = THREE.MathUtils.clamp(speed / 1200, 0.2, 1.2)

    this.sphere.rotation.x += 0.14 + speedPulse * 0.03
    this.sphere.rotation.y += 0.18 + speedPulse * 0.04
    this.shell.rotation.y -= 0.04
    this.shell.rotation.z += 0.02

    this.pulseTime += 0.14 + speedPulse * 0.04
    this.sphereMaterial.emissiveIntensity = 1.9 + Math.sin(this.pulseTime) * 0.4 + speedPulse * 0.9
    this.shellMaterial.opacity = 0.18 + speedPulse * 0.16
    this.shell.scale.setScalar(0.92 + Math.sin(this.pulseTime * 0.7) * 0.05)

    this.trailPoints.push(new THREE.Vector3(cx, cy, cz))
    while (this.trailPoints.length > MAX_TRAIL_POINTS) this.trailPoints.shift()
    if (this.trailPoints.length >= 2) {
      this.trail.geometry.dispose()
      this.trail.geometry = new THREE.BufferGeometry().setFromPoints(this.trailPoints)
    }

    const trailMaterial = this.trail.material as THREE.LineBasicMaterial
    trailMaterial.opacity = 0.42 + speedPulse * 0.45

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
    this.shell.geometry.dispose()
    this.sphereMaterial.dispose()
    this.shellMaterial.dispose()
    this.trail.geometry.dispose()
    ;(this.trail.material as THREE.Material).dispose()
  }

  private playImpact(): void {
    const trailMaterial = this.trail.material as THREE.LineBasicMaterial
    gsap.to(trailMaterial, {
      opacity: 0,
      duration: 0.16,
      ease: 'power2.out',
    })
    gsap.to(this.sphereMaterial, {
      emissiveIntensity: 5.2,
      opacity: 0,
      duration: 0.24,
      ease: 'power2.out',
    })
    gsap.to(this.shellMaterial, {
      opacity: 0,
      duration: 0.18,
      ease: 'power2.out',
    })
    gsap.to(this.group.scale, {
      x: this.group.scale.x * 2.05,
      y: this.group.scale.y * 2.05,
      z: this.group.scale.z * 2.05,
      duration: 0.2,
      ease: 'power2.out',
    })
  }

  private playFade(): void {
    const trailMaterial = this.trail.material as THREE.LineBasicMaterial
    gsap.to(trailMaterial, {
      opacity: 0,
      duration: 0.16,
      ease: 'power1.out',
    })
    gsap.to(this.group.scale, {
      x: this.group.scale.x * 0.58,
      y: this.group.scale.y * 0.58,
      z: this.group.scale.z * 0.58,
      duration: 0.24,
      ease: 'power2.in',
    })
    gsap.to(this.sphereMaterial, {
      opacity: 0,
      emissiveIntensity: 0.2,
      duration: 0.22,
    })
    gsap.to(this.shellMaterial, {
      opacity: 0,
      duration: 0.18,
    })
  }
}
