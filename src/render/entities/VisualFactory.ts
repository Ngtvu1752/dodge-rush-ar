import { ObstacleType, type Obstacle } from '../../entities/Obstacle'
import type { VisualAdapter } from './VisualAdapter'
import { RedWallVisual } from './RedWallVisual'
import { HighLaserVisual } from './HighLaserVisual'
import { BlueOrbVisual } from './BlueOrbVisual'

export function createVisual(obstacle: Obstacle): VisualAdapter | null {
  switch (obstacle.type) {
    case ObstacleType.RedWallLeft:
    case ObstacleType.RedWallRight:
      return new RedWallVisual(obstacle.width, obstacle.height)
    case ObstacleType.HighLaser:
      return new HighLaserVisual(obstacle.width)
    case ObstacleType.BlueOrb:
      return new BlueOrbVisual()
    default:
      return null
  }
}
