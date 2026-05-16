import type { Renderer } from '../render/Renderer'

export const ObstacleType = {
  RedWallLeft: 'RedWallLeft',
  RedWallRight: 'RedWallRight',
  HighLaser: 'HighLaser',
  BlueOrb: 'BlueOrb',
} as const

export type ObstacleType = (typeof ObstacleType)[keyof typeof ObstacleType]

export interface Obstacle {
  id: string
  type: ObstacleType
  x: number
  y: number
  width: number
  height: number
  speed: number
  active: boolean
  resolved: boolean
  update(dt: number): void
  render(renderer: Renderer): void
}
