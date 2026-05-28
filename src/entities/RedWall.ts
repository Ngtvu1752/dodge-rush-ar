import type { Renderer } from '../render/Renderer'
import { ObstacleType, type Obstacle } from './Obstacle'
import {
  OBSTACLE_SPAWN_Z,
  OBSTACLE_Z_DESPAWN,
  OBSTACLE_Z_HIT_ZONE,
  RED_WALL_CENTER_WIDTH_RATIO,
  RED_WALL_CENTER_X_JITTER,
  RED_WALL_SPAWN_SIDE_MAX,
  RED_WALL_SPAWN_SIDE_MIN,
  RED_WALL_SPAWN_Y_MAX,
  RED_WALL_SPAWN_Y_MIN,
  VANISHING_POINT_FOCAL_LENGTH,
} from '../config/gameConfig'

let nextId = 0
function makeId(): string {
  return `rw_${nextId++}`
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function getRandomWallSpawn(canvasWidth: number, canvasHeight: number, side: 'left' | 'right'): { worldX: number, worldY: number } {
  const horizontalRatio = randomRange(RED_WALL_SPAWN_SIDE_MIN, RED_WALL_SPAWN_SIDE_MAX)
  const verticalRatio = randomRange(RED_WALL_SPAWN_Y_MIN, RED_WALL_SPAWN_Y_MAX)
  const sign = side === 'left' ? -1 : 1

  return {
    worldX: sign * canvasWidth * horizontalRatio,
    worldY: canvasHeight * verticalRatio,
  }
}

function getRandomCenterWallSpawn(canvasWidth: number, canvasHeight: number): { worldX: number, worldY: number } {
  const horizontalJitter = randomRange(-RED_WALL_CENTER_X_JITTER, RED_WALL_CENTER_X_JITTER)
  const verticalRatio = randomRange(RED_WALL_SPAWN_Y_MIN, RED_WALL_SPAWN_Y_MAX)

  return {
    worldX: canvasWidth * horizontalJitter,
    worldY: canvasHeight * verticalRatio,
  }
}

export class RedWallLeft implements Obstacle {
  id: string
  type = ObstacleType.RedWallLeft
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

  readonly requiredAction = 'dodgeRight' as const
  readonly worldX: number
  readonly worldY: number
  worldZ: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  resultCause: 'dodge' | 'projectile' | 'touch' | undefined = undefined
  private canvasW: number
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.canvasW = canvasWidth
    this.canvasH = canvasHeight
    this.baseWidth = canvasWidth * 0.4
    this.baseHeight = canvasHeight * 0.6
    const spawn = getRandomWallSpawn(canvasWidth, canvasHeight, 'left')
    this.worldX = spawn.worldX
    this.worldY = spawn.worldY
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
      ? 'rgba(255, 0, 0, 0.5)'
      : approaching
        ? 'rgba(255, 0, 0, 0.25)'
        : 'rgba(255, 0, 0, 0.15)'
    const stroke = this.inHitZone ? '#ff0000' : '#ff4444'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    const labelX = this.x + this.width / 2
    const labelY = this.y + this.height / 2

    r.drawText('MOVE RIGHT', labelX, labelY, {
      size: Math.max(12, 24 * (this.width / this.baseWidth)),
      color: this.inHitZone ? '#ffffff' : '#ffcccc',
    })

    if (this.inHitZone) {
      r.drawText('>>> ', labelX, labelY + 30 * (this.width / this.baseWidth), {
        size: Math.max(14, 28 * (this.width / this.baseWidth)),
        color: '#ffffff',
      })
    }

    if (this.result === 'success') {
      r.drawText('DODGED!', labelX, Math.max(this.y - 20, 30), {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('HIT!', labelX, Math.max(this.y - 20, 30), {
        size: 36,
        color: '#ff4444',
      })
    }
  }
}

export class RedWallRight implements Obstacle {
  id: string
  type = ObstacleType.RedWallRight
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

  readonly requiredAction = 'dodgeLeft' as const
  readonly worldX: number
  readonly worldY: number
  worldZ: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  resultCause: 'dodge' | 'projectile' | 'touch' | undefined = undefined
  private canvasW: number
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.canvasW = canvasWidth
    this.canvasH = canvasHeight
    this.baseWidth = canvasWidth * 0.4
    this.baseHeight = canvasHeight * 0.6
    const spawn = getRandomWallSpawn(canvasWidth, canvasHeight, 'right')
    this.worldX = spawn.worldX
    this.worldY = spawn.worldY
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
      ? 'rgba(255, 0, 0, 0.5)'
      : approaching
        ? 'rgba(255, 0, 0, 0.25)'
        : 'rgba(255, 0, 0, 0.15)'
    const stroke = this.inHitZone ? '#ff0000' : '#ff4444'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    const labelX = this.x + this.width / 2
    const labelY = this.y + this.height / 2

    r.drawText('MOVE LEFT', labelX, labelY, {
      size: Math.max(12, 24 * (this.width / this.baseWidth)),
      color: this.inHitZone ? '#ffffff' : '#ffcccc',
    })

    if (this.inHitZone) {
      r.drawText(' <<<', labelX, labelY + 30 * (this.width / this.baseWidth), {
        size: Math.max(14, 28 * (this.width / this.baseWidth)),
        color: '#ffffff',
      })
    }

    if (this.result === 'success') {
      r.drawText('DODGED!', labelX, Math.max(this.y - 20, 30), {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('HIT!', labelX, Math.max(this.y - 20, 30), {
        size: 36,
        color: '#ff4444',
      })
    }
  }
}

export class RedWallCenter implements Obstacle {
  id: string
  type = ObstacleType.RedWallCenter
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

  readonly requiredAction = 'dodgeEither' as const
  readonly worldX: number
  readonly worldY: number
  worldZ: number
  inHitZone = false
  graceStart = 0
  result: 'success' | 'fail' | null = null
  resultCause: 'dodge' | 'projectile' | 'touch' | undefined = undefined
  private canvasW: number
  private canvasH: number

  constructor(canvasWidth: number, canvasHeight: number, speed: number) {
    this.id = makeId()
    this.canvasW = canvasWidth
    this.canvasH = canvasHeight
    this.baseWidth = canvasWidth * RED_WALL_CENTER_WIDTH_RATIO
    this.baseHeight = canvasHeight * 0.62
    const spawn = getRandomCenterWallSpawn(canvasWidth, canvasHeight)
    this.worldX = spawn.worldX
    this.worldY = spawn.worldY
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
      ? 'rgba(255, 0, 0, 0.5)'
      : approaching
        ? 'rgba(255, 0, 0, 0.25)'
        : 'rgba(255, 0, 0, 0.15)'
    const stroke = this.inHitZone ? '#ff0000' : '#ff4444'

    r.drawRect(this.x, this.y, this.width, this.height, fill, stroke, 2)

    const labelX = this.x + this.width / 2
    const labelY = this.y + this.height / 2

    r.drawText('MOVE SIDE', labelX, labelY, {
      size: Math.max(12, 24 * (this.width / this.baseWidth)),
      color: this.inHitZone ? '#ffffff' : '#ffcccc',
    })

    if (this.result === 'success') {
      r.drawText('DODGED!', labelX, Math.max(this.y - 20, 30), {
        size: 36,
        color: '#00ff88',
      })
    } else if (this.result === 'fail') {
      r.drawText('HIT!', labelX, Math.max(this.y - 20, 30), {
        size: 36,
        color: '#ff4444',
      })
    }
  }
}
