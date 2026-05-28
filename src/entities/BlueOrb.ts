import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'
import {
  BLUE_ORB_APPROACH_SPEED_FACTOR,
  BLUE_ORB_SPAWN_X_JITTER,
  BLUE_ORB_SPAWN_X_LANES,
  BLUE_ORB_SPAWN_Y_BANDS,
  BLUE_ORB_SPAWN_Y_JITTER,
  BLUE_ORB_SPAWN_Z_MAX,
  BLUE_ORB_SPAWN_Z_MIN,
  HAND_INTERACTION_PLANE_Z,
  ORB_LIFETIME_SEC,
  VANISHING_POINT_FOCAL_LENGTH,
} from '../config/gameConfig'

let nextId = 0
function makeId(): string {
  return `bo_${nextId++}`
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export class BlueOrb implements Obstacle {
  id: string
  type = ObstacleType.BlueOrb
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

  readonly radius: number
  graceStart = 0
  result: 'success' | 'fail' | null = null
  resultCause: 'dodge' | 'projectile' | 'touch' | undefined = undefined
  interactionState: 'free' | 'candidate' | 'grabbed' | 'thrown' | 'consumed' = 'free'
  grabbedBy: 'left' | 'right' | null = null

  worldX = 0
  worldY = 0
  worldZ = 0

  private anchorWorldX = 0
  private anchorWorldY = 0
  private age = 0
  private lifetime = ORB_LIFETIME_SEC
  private floatPhase = Math.random() * Math.PI * 2

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.radius = 35
    this.baseWidth = this.radius * 2
    this.baseHeight = this.radius * 2
    this.speed = speed

    const laneX = pickRandom(BLUE_ORB_SPAWN_X_LANES)
    const bandY = pickRandom(BLUE_ORB_SPAWN_Y_BANDS)
    this.anchorWorldX = canvasWidth * (laneX + randomRange(-BLUE_ORB_SPAWN_X_JITTER, BLUE_ORB_SPAWN_X_JITTER))
    this.anchorWorldY = canvasHeight * (bandY + randomRange(-BLUE_ORB_SPAWN_Y_JITTER, BLUE_ORB_SPAWN_Y_JITTER))
    this.worldZ = randomRange(BLUE_ORB_SPAWN_Z_MIN, BLUE_ORB_SPAWN_Z_MAX)

    this.project(canvasWidth, canvasHeight)
  }

  get centerX(): number {
    return this.x + this.width / 2
  }

  get centerY(): number {
    return this.y + this.height / 2
  }

  get screenRadius(): number {
    return this.width / 2
  }

  update(dt: number): void {
    if (this.interactionState === 'grabbed' || this.interactionState === 'consumed') {
      return
    }

    this.age += dt
    if (this.age >= this.lifetime) {
      this.active = false
      return
    }

    this.worldZ -= this.speed * BLUE_ORB_APPROACH_SPEED_FACTOR * dt
    this.project(window.innerWidth, window.innerHeight)
  }

  setCandidate(candidate: boolean): void {
    if (this.interactionState === 'free' || this.interactionState === 'candidate') {
      this.interactionState = candidate ? 'candidate' : 'free'
    }
  }

  attachToHand(
    handedness: 'left' | 'right',
    screenX: number,
    screenY: number,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    this.grabbedBy = handedness
    this.interactionState = 'grabbed'
    this.followHand(screenX, screenY, viewportWidth, viewportHeight)
  }

  followHand(screenX: number, screenY: number, viewportWidth: number, viewportHeight: number): void {
    this.worldZ = HAND_INTERACTION_PLANE_Z
    const scale = VANISHING_POINT_FOCAL_LENGTH / (VANISHING_POINT_FOCAL_LENGTH + this.worldZ)
    const cx = viewportWidth / 2
    const cy = viewportHeight / 2
    this.worldX = (screenX - cx) / scale
    this.worldY = (screenY - cy) / scale
    this.project(viewportWidth, viewportHeight)
  }

  releaseToThrow(): void {
    this.interactionState = 'thrown'
    this.grabbedBy = null
    this.active = false
  }

  consume(): void {
    this.interactionState = 'consumed'
    this.grabbedBy = null
    this.active = false
  }

  private project(canvasWidth: number, canvasHeight: number): void {
    if (this.interactionState === 'free' || this.interactionState === 'candidate') {
      const orbitX = Math.sin(this.age * 1.4 + this.floatPhase) * 42
      const orbitY = Math.cos(this.age * 1.9 + this.floatPhase) * 26

      this.worldX = this.anchorWorldX + orbitX
      this.worldY = this.anchorWorldY + orbitY
    }

    const cx = canvasWidth / 2
    const cy = canvasHeight / 2
    const scale = VANISHING_POINT_FOCAL_LENGTH / (VANISHING_POINT_FOCAL_LENGTH + this.worldZ)

    const projectedWidth = this.baseWidth * scale
    const projectedHeight = this.baseHeight * scale

    this.x = cx + this.worldX * scale - projectedWidth / 2
    this.y = cy + this.worldY * scale - projectedHeight / 2
    this.z = this.worldZ
    this.width = projectedWidth
    this.height = projectedHeight
  }

  render(r: Renderer): void {
    if (this.screenRadius < 2) return

    const pulse = Math.sin(this.age * 5) * Math.max(2, this.screenRadius * 0.12)
    const drawRadius = this.screenRadius + pulse

    const ctx = r.ctx
    ctx.save()

    r.drawCircle(this.centerX, this.centerY, drawRadius, '#0f6fff', '#9dd0ff', 4)

    r.drawText('TOUCH', this.centerX, this.centerY + drawRadius + 20, {
      size: Math.max(14, 20 * (this.width / this.baseWidth)),
      color: '#ffffff',
    })

    if (this.result === 'success') {
      r.drawText('TOUCHED!', this.centerX, this.centerY - drawRadius - 15, {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('MISSED', this.centerX, this.centerY - drawRadius - 15, {
        size: 36,
        color: '#ff8844',
      })
    }

    ctx.restore()
  }
}
