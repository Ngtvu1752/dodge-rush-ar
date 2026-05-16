import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'

let nextId = 0
function makeId(): string {
  return `hl_${nextId++}`
}

export class HighLaser implements Obstacle {
  id: string
  type = ObstacleType.HighLaser
  x: number
  y: number
  width: number
  height: number
  speed: number
  active = true
  resolved = false

  readonly requiredAction = 'squat' as const
  hitZoneY: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.width = canvasWidth
    this.height = 20
    this.x = 0
    this.y = -this.height
    this.speed = speed
    this.canvasH = canvasHeight
    this.hitZoneY = canvasHeight * 0.6
  }

  update(dt: number): void {
    this.y += this.speed * dt
    this.inHitZone = this.y + this.height >= this.hitZoneY && this.y <= this.hitZoneY
    if (this.y > this.canvasH) this.active = false
  }

  render(r: Renderer): void {
    const approaching = this.y + this.height > 0 && !this.inHitZone
    const fill = this.inHitZone
      ? 'rgba(255, 100, 0, 0.7)'
      : approaching
        ? 'rgba(255, 100, 0, 0.4)'
        : 'rgba(255, 100, 0, 0.2)'
    const stroke = this.inHitZone ? '#ff8800' : '#ff6600'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    if (this.y + this.height > 0) {
      const labelY = Math.max(this.y - 15, 30)
      r.drawText('SQUAT!', this.width / 2, labelY, {
        size: 24,
        color: this.inHitZone ? '#ffffff' : '#ffcc88',
      })

      if (this.result === 'success') {
        r.drawText('SQUAT OK', this.width / 2, Math.max(this.y - 40, 30), {
          size: 36,
          color: '#00ff88',
        })
      } else if (this.result === 'fail') {
        r.drawText('HIT!', this.width / 2, Math.max(this.y - 40, 30), {
          size: 36,
          color: '#ff4444',
        })
      }
    }
  }
}
