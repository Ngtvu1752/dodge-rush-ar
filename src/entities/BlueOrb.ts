import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'
import { ORB_LIFETIME_SEC } from '../config/gameConfig'

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
  speed = 0
  active = true
  resolved = false

  readonly radius: number
  graceStart = 0
  result: 'success' | 'fail' | null = null

  private age = 0
  private lifetime = ORB_LIFETIME_SEC

  constructor(canvasWidth: number, canvasHeight: number, _speed: number) {
    this.id = makeId()
    this.radius = 35
    this.width = this.radius * 2
    this.height = this.radius * 2

    // Static spawn in center 50% of screen, middle 45% vertically
    this.x = canvasWidth * (0.25 + Math.random() * 0.5)
    this.y = canvasHeight * (0.2 + Math.random() * 0.45)
  }

  get centerX(): number {
    return this.x
  }

  get centerY(): number {
    return this.y
  }

  update(dt: number): void {
    this.age += dt
    if (this.age >= this.lifetime) this.active = false
  }

  render(r: Renderer): void {
    // Pulse effect: radius oscillates to draw attention
    const pulse = Math.sin(this.age * 5) * 5
    const drawRadius = this.radius + pulse

    // Fade out in the last 0.5 seconds
    const fadeAlpha = this.age > this.lifetime - 0.5
      ? (this.lifetime - this.age) / 0.5
      : 1

    const ctx = r.ctx
    ctx.save()
    ctx.globalAlpha = fadeAlpha

    const fill = 'rgba(0, 120, 255, 0.6)'
    const stroke = '#4488ff'
    r.drawCircle(this.x, this.y, drawRadius, fill, stroke, 3)

    // Label
    const labelY = this.y + drawRadius + 20
    r.drawText('TOUCH', this.x, labelY, {
      size: 20,
      color: '#ffffff',
    })

    if (this.result === 'success') {
      r.drawText('TOUCHED!', this.x, this.y - drawRadius - 15, {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('MISSED', this.x, this.y - drawRadius - 15, {
        size: 36,
        color: '#ff8844',
      })
    }

    ctx.restore()
  }
}
