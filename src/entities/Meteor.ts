import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'
import {
  METEOR_SPAWN_Z,
  METEOR_HIT_ZONE_Z,
  METEOR_DESPAWN_Z,
  METEOR_SCREEN_RADIUS,
  METEOR_SPIN_SPEED,
  VANISHING_POINT_FOCAL_LENGTH,
} from '../config/gameConfig'

let nextId = 0
function makeId(): string {
  return `mt_${nextId++}`
}

export class Meteor implements Obstacle {
  id: string
  type = ObstacleType.Meteor
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

  readonly worldX: number
  readonly worldY: number
  worldZ: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  resultCause: 'dodge' | 'projectile' | 'touch' | undefined = undefined

  /** Current rotation angles for spin animation (radians) */
  rotX = 0
  rotY = 0

  /** Screen-space radius for collision (updated each frame by project()) */
  screenRadius = 0

  get centerX(): number {
    return this.x + this.width / 2
  }

  get centerY(): number {
    return this.y + this.height / 2
  }

  private canvasW: number
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.canvasW = canvasWidth
    this.canvasH = canvasHeight

    // Meteor appears at a random horizontal position, slightly above center
    this.worldX = (Math.random() - 0.5) * canvasWidth * 0.6
    this.worldY = -(canvasHeight * 0.15 + Math.random() * canvasHeight * 0.2)
    this.worldZ = METEOR_SPAWN_Z

    // Base size — the visual radius of the meteor in world units
    const radius = METEOR_SCREEN_RADIUS
    this.baseWidth = radius * 2
    this.baseHeight = radius * 2

    this.speed = speed
    this.rotX = Math.random() * Math.PI * 2
    this.rotY = Math.random() * Math.PI * 2

    this.project()
  }

  update(dt: number): void {
    // Move toward camera
    this.worldZ -= this.speed * dt

    // Continuous spin for visual effect
    this.rotX += METEOR_SPIN_SPEED * dt
    this.rotY += METEOR_SPIN_SPEED * 0.7 * dt

    // Project to screen space
    this.project()

    // Hit zone: when meteor is close to camera
    this.inHitZone = this.worldZ <= METEOR_HIT_ZONE_Z

    // Despawn: passed through the camera
    if (this.worldZ <= -METEOR_DESPAWN_Z) {
      this.active = false
    }
  }

  private project(): void {
    const cx = this.canvasW / 2
    const cy = this.canvasH / 2
    const scale = VANISHING_POINT_FOCAL_LENGTH / (VANISHING_POINT_FOCAL_LENGTH + this.worldZ)

    const projectedWidth = this.baseWidth * scale
    const projectedHeight = this.baseHeight * scale

    this.x = cx + this.worldX * scale - projectedWidth / 2
    this.y = cy + this.worldY * scale - projectedHeight / 2
    this.z = this.worldZ
    this.width = projectedWidth
    this.height = projectedHeight
    this.screenRadius = METEOR_SCREEN_RADIUS * scale
  }

  render(r: Renderer): void {
    // Canvas2D fallback — draw a circle if no Three.js visual
    if (this.screenRadius < 2) return

    const alpha = this.inHitZone ? 0.7 : 0.4
    r.drawCircle(this.centerX, this.centerY, this.screenRadius, `rgba(180, 80, 40, ${alpha})`, '#ff6633', 2)

    const labelSize = Math.max(10, 16 * (this.screenRadius / METEOR_SCREEN_RADIUS))
    r.drawText('DODGE!', this.centerX, this.centerY - this.screenRadius - 10, {
      size: labelSize,
      color: this.inHitZone ? '#ffffff' : '#ffaa88',
    })

    if (this.result === 'success') {
      r.drawText('DODGED!', this.centerX, this.centerY - this.screenRadius - 30, {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('HIT!', this.centerX, this.centerY - this.screenRadius - 30, {
        size: 36,
        color: '#ff4444',
      })
    }
  }
}
