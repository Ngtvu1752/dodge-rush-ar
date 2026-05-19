import type * as THREE from 'three'
import type { Obstacle } from '../../entities/Obstacle'
import type { VisualAdapter } from './VisualAdapter'
import { createVisual } from './VisualFactory'

export class ObstacleVisualManager {
  private visuals = new Map<string, VisualAdapter>()
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  sync(obstacles: readonly Obstacle[], canvasW: number, canvasH: number): void {
    const activeIds = new Set<string>()

    for (const obstacle of obstacles) {
      activeIds.add(obstacle.id)

      let visual = this.visuals.get(obstacle.id)
      if (!visual) {
        const created = createVisual(obstacle)
        if (created) {
          created.addToScene(this.scene)
          this.visuals.set(obstacle.id, created)
          visual = created
        }
      }

      if (visual) {
        visual.sync(obstacle, canvasW, canvasH)
      }
    }

    // Dispose visuals for obstacles that are no longer active
    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        visual.removeFromScene(this.scene)
        visual.dispose()
        this.visuals.delete(id)
      }
    }
  }

  hasVisual(id: string): boolean {
    return this.visuals.has(id)
  }

  dispose(): void {
    for (const visual of this.visuals.values()) {
      visual.removeFromScene(this.scene)
      visual.dispose()
    }
    this.visuals.clear()
  }
}
