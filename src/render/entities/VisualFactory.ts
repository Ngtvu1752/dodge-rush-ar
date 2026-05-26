import { ObstacleType, type Obstacle } from '../../entities/Obstacle'
import type { VisualAdapter } from './VisualAdapter'
import { RedWallVisual } from './RedWallVisual'
import { HighLaserVisual } from './HighLaserVisual'
import { BlueOrbVisual } from './BlueOrbVisual'
import { MeteorVisual } from './MeteorVisual'

export function createVisual(obstacle: Obstacle): VisualAdapter | null {
  switch (obstacle.type) {
    case ObstacleType.RedWallLeft:
    case ObstacleType.RedWallRight:
    case ObstacleType.RedWallCenter:
      return new RedWallVisual(obstacle.baseWidth, obstacle.baseHeight)
    case ObstacleType.HighLaser:
      return new HighLaserVisual(obstacle.baseWidth)
    case ObstacleType.BlueOrb:
      return new BlueOrbVisual()
    case ObstacleType.Meteor:
      return new MeteorVisual()
    default:
      return null
  }
}
