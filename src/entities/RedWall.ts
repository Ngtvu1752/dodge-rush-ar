import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'

let nextId = 0
function makeId(): string {
  return `rw_${nextId++}`
}

export class RedWallLeft implements Obstacle {
  id: string
  type = ObstacleType.RedWallLeft
  x: number
  y: number
  width: number
  height: number
  speed: number
  active = true
  resolved = false

  readonly requiredAction = 'dodgeRight' as const
  hitZoneY: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.width = canvasWidth * 0.4
    this.height = canvasHeight * 0.6
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
      ? 'rgba(255, 0, 0, 0.5)'
      : approaching
        ? 'rgba(255, 0, 0, 0.25)'
        : 'rgba(255, 0, 0, 0.15)'
    const stroke = this.inHitZone ? '#ff0000' : '#ff4444'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    if (this.y + this.height > 0) {
      const labelY = Math.max(this.y + this.height / 2, 30)
      r.drawText('MOVE RIGHT', this.width / 2, labelY, {
        size: 24,
        color: this.inHitZone ? '#ffffff' : '#ffcccc',
      })

      if (this.inHitZone) {
        r.drawText('>>> ', this.width / 2, labelY + 30, {
          size: 28,
          color: '#ffffff',
        })
      }

      if (this.result === 'success') {
        r.drawText('DODGED!', this.width / 2, Math.max(this.y - 20, 30), {
          size: 36,
          color: '#00ff88',
        })
      } else if (this.result === 'fail') {
        r.drawText('HIT!', this.width / 2, Math.max(this.y - 20, 30), {
          size: 36,
          color: '#ff4444',
        })
      }
    }
  }
}

export class RedWallRight implements Obstacle {
  id: string
  type = ObstacleType.RedWallRight
  x: number
  y: number
  width: number
  height: number
  speed: number
  active = true
  resolved = false

  readonly requiredAction = 'dodgeLeft' as const
  hitZoneY: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.width = canvasWidth * 0.4
    this.height = canvasHeight * 0.6
    this.x = canvasWidth - this.width
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
      ? 'rgba(255, 0, 0, 0.5)'
      : approaching
        ? 'rgba(255, 0, 0, 0.25)'
        : 'rgba(255, 0, 0, 0.15)'
    const stroke = this.inHitZone ? '#ff0000' : '#ff4444'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    if (this.y + this.height > 0) {
      const labelY = Math.max(this.y + this.height / 2, 30)
      r.drawText('MOVE LEFT', this.x + this.width / 2, labelY, {
        size: 24,
        color: this.inHitZone ? '#ffffff' : '#ffcccc',
      })

      if (this.inHitZone) {
        r.drawText(' <<<', this.x + this.width / 2, labelY + 30, {
          size: 28,
          color: '#ffffff',
        })
      }

      if (this.result === 'success') {
        r.drawText('DODGED!', this.x + this.width / 2, Math.max(this.y - 20, 30), {
          size: 36,
          color: '#00ff88',
        })
      } else if (this.result === 'fail') {
        r.drawText('HIT!', this.x + this.width / 2, Math.max(this.y - 20, 30), {
          size: 36,
          color: '#ff4444',
        })
      }
    }
  }
}
