import * as THREE from 'three'
import type { BlueOrb } from '../../entities/BlueOrb'

export class GrabIndicator {
  private scene: THREE.Scene
  private ring: THREE.Mesh
  private time = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(42, 56, 48),
      new THREE.MeshBasicMaterial({
        color: 0xaee4ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.scene.add(this.ring)
    this.ring.visible = false
  }

  sync(candidate: BlueOrb | null, dt: number): void {
    this.time += dt
    if (!candidate) {
      this.ring.visible = false
      return
    }

    const scale = candidate.baseWidth > 0 ? candidate.width / candidate.baseWidth : 1
    this.ring.visible = true
    this.ring.position.set(candidate.centerX, -candidate.centerY, -candidate.z + 3)
    const pulse = 1 + Math.sin(this.time * 8) * 0.12
    this.ring.scale.set(scale * pulse, scale * pulse, scale)
    ;(this.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(this.time * 8) * 0.15
  }

  dispose(): void {
    this.scene.remove(this.ring)
    this.ring.geometry.dispose()
    ;(this.ring.material as THREE.Material).dispose()
  }
}
