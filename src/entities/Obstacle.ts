import type { Renderer } from '../render/Renderer'

export const ObstacleType = {
  RedWallLeft: 'RedWallLeft',
  RedWallRight: 'RedWallRight',
  RedWallCenter: 'RedWallCenter',
  HighLaser: 'HighLaser',
  BlueOrb: 'BlueOrb',
  Meteor: 'Meteor',
} as const

export type ObstacleType = (typeof ObstacleType)[keyof typeof ObstacleType]

export interface Obstacle {
  id: string
  type: ObstacleType
  x: number
  y: number
  z: number
  width: number
  height: number
  baseWidth: number
  baseHeight: number
  speed: number
  active: boolean
  resolved: boolean
  result: 'success' | 'fail' | null
  update(dt: number): void
  render(renderer: Renderer): void
}
