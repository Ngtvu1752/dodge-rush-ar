import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'
import { OBSTACLE_SPAWN_Z, OBSTACLE_Z_DESPAWN, OBSTACLE_Z_HIT_ZONE, VANISHING_POINT_FOCAL_LENGTH } from '../config/gameConfig'

let nextId = 0
function makeId(): string {
  return `hl_${nextId++}`
}

export class HighLaser implements Obstacle {
  id: string
  type = ObstacleType.HighLaser
  x = 0
  y = 0
  z = 0
  width = 0
  height = 0
  baseWidth: number
  baseHeight: number
  speed: number
  active = true
  resolved = false

  readonly requiredAction = 'squat' as const
  readonly worldX = 0
  readonly worldY: number
  worldZ: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  private canvasW: number
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.canvasW = canvasWidth
    this.canvasH = canvasHeight
    this.baseWidth = canvasWidth
    this.baseHeight = 20
    this.worldY = -canvasHeight * 0.3
    this.worldZ = OBSTACLE_SPAWN_Z
    this.speed = speed
    this.project()
  }

  update(dt: number): void {
    this.worldZ -= this.speed * dt
    this.project()
    this.inHitZone = this.worldZ <= OBSTACLE_Z_HIT_ZONE
    if (this.worldZ <= -OBSTACLE_Z_DESPAWN) this.active = false
  }

  private project(): void {
    const cx = this.canvasW / 2
    const cy = this.canvasH / 2
    const scale = VANISHING_POINT_FOCAL_LENGTH / (VANISHING_POINT_FOCAL_LENGTH + this.worldZ)
    this.x = cx + this.worldX * scale - this.baseWidth * scale / 2
    this.y = cy + this.worldY * scale - this.baseHeight * scale / 2
    this.z = this.worldZ
    this.width = this.baseWidth * scale
    this.height = this.baseHeight * scale
  }

  render(r: Renderer): void {
    if (this.width < 1 || this.height < 1) return

    const approaching = !this.inHitZone
    const fill = this.inHitZone
      ? 'rgba(255, 100, 0, 0.7)'
      : approaching
        ? 'rgba(255, 100, 0, 0.4)'
        : 'rgba(255, 100, 0, 0.2)'
    const stroke = this.inHitZone ? '#ff8800' : '#ff6600'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    const labelX = this.x + this.width / 2
    const labelY = this.y - 15 * (this.width / this.baseWidth)

    r.drawText('SQUAT!', labelX, Math.max(labelY, 30), {
      size: Math.max(12, 24 * (this.width / this.baseWidth)),
      color: this.inHitZone ? '#ffffff' : '#ffcc88',
    })

    if (this.result === 'success') {
      r.drawText('SQUAT OK', labelX, Math.max(this.y - 40 * (this.width / this.baseWidth), 30), {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('HIT!', labelX, Math.max(this.y - 40 * (this.width / this.baseWidth), 30), {
        size: 36,
        color: '#ff4444',
      })
    }
  }
}
