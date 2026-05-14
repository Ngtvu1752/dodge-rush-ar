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

let nextId = 0
function makeId(prefix: string): string {
  return `${prefix}_${nextId++}`
}

export class HighLaser implements Obstacle {
  id: string
  type = ObstacleType.HighLaser as ObstacleType
  x: number
  y: number
  width: number
  height: number
  speed: number
  active = true
  resolved = false
  private canvasHeight: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId('hl')
    this.width = canvasWidth * 0.7
    this.height = 20
    this.x = (canvasWidth - this.width) / 2
    this.y = -this.height
    this.speed = speed
    this.canvasHeight = canvasHeight
  }

  update(dt: number): void {
    this.y += this.speed * dt
    if (this.y > this.canvasHeight) this.active = false
  }

  render(r: Renderer): void {
    r.drawRect(this.x, this.y, this.width, this.height, 'rgba(255,100,0,0.6)', '#ff8800', 2)
    r.drawText('SQUAT!', this.x + this.width / 2, this.y - 15, {
      size: 18,
      color: '#ff8800',
    })
  }
}

export class BlueOrb implements Obstacle {
  id: string
  type = ObstacleType.BlueOrb as ObstacleType
  x: number
  y: number
  width: number
  height: number
  speed: number
  active = true
  resolved = false

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId('bo')
    const radius = 30
    this.width = radius * 2
    this.height = radius * 2
    this.x = canvasWidth + radius
    this.y = canvasHeight * (0.2 + Math.random() * 0.6)
    this.speed = speed
  }

  update(dt: number): void {
    this.x -= this.speed * dt
    if (this.x + this.width < 0) this.active = false
  }

  render(r: Renderer): void {
    r.drawCircle(this.x, this.y, this.width / 2, 'rgba(0,120,255,0.5)', '#4488ff', 2)
    r.drawText('TOUCH', this.x, this.y + this.width / 2 + 15, {
      size: 14,
      color: '#4488ff',
    })
  }
}
