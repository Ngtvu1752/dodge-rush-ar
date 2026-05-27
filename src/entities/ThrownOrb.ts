import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'
import {
  THROWN_ORB_GRAVITY,
  THROWN_ORB_LIFETIME_SEC,
  VANISHING_POINT_FOCAL_LENGTH,
} from '../config/gameConfig'

let nextId = 0

function makeId(): string {
  return `to_${nextId++}`
}

export class ThrownOrb implements Obstacle {
  id: string
  type = ObstacleType.ThrownOrb
  x = 0
  y = 0
  z = 0
  width = 0
  height = 0
  baseWidth: number
  baseHeight: number
  speed = 0
  active = true
  resolved = false
  result: 'success' | 'fail' | null = null

  worldX: number
  worldY: number
  worldZ: number
  velocityX: number
  velocityY: number
  velocityZ: number
  owner: 'left' | 'right'
  age = 0
  lifetime = THROWN_ORB_LIFETIME_SEC
  hitTargetId: string | null = null

  constructor(
    owner: 'left' | 'right',
    worldX: number,
    worldY: number,
    worldZ: number,
    velocityX: number,
    velocityY: number,
    velocityZ: number,
  ) {
    this.id = makeId()
    this.baseWidth = 56
    this.baseHeight = 56
    this.owner = owner
    this.worldX = worldX
    this.worldY = worldY
    this.worldZ = worldZ
    this.velocityX = velocityX
    this.velocityY = velocityY
    this.velocityZ = velocityZ
    this.project()
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
    this.age += dt
    if (this.age >= this.lifetime) {
      this.active = false
      if (!this.resolved) {
        this.result = 'fail'
        this.resolved = true
      }
      return
    }

    this.velocityY += THROWN_ORB_GRAVITY * dt
    this.worldX += this.velocityX * dt
    this.worldY += this.velocityY * dt
    this.worldZ -= this.velocityZ * dt

    this.project()

    if (
      this.worldZ <= -120 ||
      this.x + this.width < -80 ||
      this.x > window.innerWidth + 80 ||
      this.y + this.height < -80 ||
      this.y > window.innerHeight + 80
    ) {
      this.active = false
      if (!this.resolved) {
        this.result = 'fail'
        this.resolved = true
      }
    }
  }

  render(r: Renderer): void {
    if (this.screenRadius < 2) return
    r.drawCircle(this.centerX, this.centerY, this.screenRadius, 'rgba(80, 160, 255, 0.75)', '#aaddff', 2)
  }

  private project(): void {
    const scale = VANISHING_POINT_FOCAL_LENGTH / (VANISHING_POINT_FOCAL_LENGTH + this.worldZ)
    const projectedWidth = this.baseWidth * scale
    const projectedHeight = this.baseHeight * scale
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    this.x = cx + this.worldX * scale - projectedWidth / 2
    this.y = cy + this.worldY * scale - projectedHeight / 2
    this.z = this.worldZ
    this.width = projectedWidth
    this.height = projectedHeight
  }
}
