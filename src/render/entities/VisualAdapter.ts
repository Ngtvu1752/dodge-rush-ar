import type * as THREE from 'three'
import type { Obstacle } from '../../entities/Obstacle'

export interface VisualAdapter {
  sync(obstacle: Obstacle, canvasW: number, canvasH: number): void
  addToScene(scene: THREE.Scene): void
  removeFromScene(scene: THREE.Scene): void
  dispose(): void
}
