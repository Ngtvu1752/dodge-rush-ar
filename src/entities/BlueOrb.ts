import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'

let nextId = 0
function makeId(): string {
  return `bo_${nextId++}`
}

export class BlueOrb implements Obstacle {
  id: string
  type = ObstacleType.BlueOrb
  x: number
  y: number
  width: number
  height: number
  speed: number
  active = true
  resolved = false

  readonly radius: number
  hitZoneX: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  private canvasW: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.radius = 35
    this.width = this.radius * 2
    this.height = this.radius * 2
    this.canvasW = canvasWidth

    // Spawn at right edge, random Y in middle 60% of screen
    this.x = canvasWidth + this.radius
    this.y = canvasHeight * (0.2 + Math.random() * 0.6)
    this.speed = speed

    // Hit zone: center-right area of screen
    this.hitZoneX = canvasWidth * 0.6
  }

  get centerX(): number {
    return this.x
  }

  get centerY(): number {
    return this.y
  }

  update(dt: number): void {
    this.x -= this.speed * dt
    this.inHitZone = this.x <= this.hitZoneX && this.x > 0
    if (this.x + this.radius < 0) this.active = false
  }

  render(r: Renderer): void {
    const approaching = this.x < this.canvasW + this.radius && !this.inHitZone && this.x > 0
    const fill = this.inHitZone
      ? 'rgba(0, 120, 255, 0.6)'
      : approaching
        ? 'rgba(0, 120, 255, 0.35)'
        : 'rgba(0, 120, 255, 0.2)'
    const stroke = this.inHitZone ? '#4488ff' : '#2266cc'

    r.drawCircle(this.x, this.y, this.radius, fill, stroke, 3)

    // Label
    if (this.x < this.canvasW + this.radius) {
      const labelY = this.y + this.radius + 20
      r.drawText('TOUCH', this.x, labelY, {
        size: 20,
        color: this.inHitZone ? '#ffffff' : '#88bbff',
      })

      if (this.result === 'success') {
        r.drawText('TOUCHED!', this.x, this.y - this.radius - 15, {
          size: 36,
          color: '#00ff88',
        })
      } else if (this.result === 'fail') {
        r.drawText('MISSED', this.x, this.y - this.radius - 15, {
          size: 36,
          color: '#ff8844',
        })
      }
    }
  }
}
