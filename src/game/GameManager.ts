import { GameState } from './GameState'
import {
  BLUE_ORB_FORCE_GAP_SEC,
  BLUE_ORB_MIN_GAP_SEC,
  COUNTDOWN_SECONDS,
  HAND_GRAB_RADIUS_PX,
  HAND_THROW_SPEED_THRESHOLD,
  HAND_THROW_Z_VELOCITY,
  THROWN_ORB_BASE_SPEED_SCALE,
  THROWN_ORB_THROW_UPWARD_LIFT,
  THROWN_ORB_UPWARD_LIFT,
  THROWN_ORB_WEAK_TOSS_FACTOR,
  VANISHING_POINT_FOCAL_LENGTH,
} from '../config/gameConfig'
import { ScoreManager } from './ScoreManager'
import { DifficultyManager } from './DifficultyManager'
import { type Obstacle, ObstacleType } from '../entities/Obstacle'
import { RedWallCenter, RedWallLeft, RedWallRight } from '../entities/RedWall'
import { HighLaser } from '../entities/HighLaser'
import { BlueOrb } from '../entities/BlueOrb'
import { Meteor } from '../entities/Meteor'
import { ThrownOrb } from '../entities/ThrownOrb'
import { CollisionSystem, type BlueOrbTouchPolicy } from '../collision/CollisionSystem'
import type { PlayerAction } from '../input/GestureDetector'
import type { HandTracker, TrackedHandState } from '../input/HandTracker'
import type { PoseData } from '../pose/PoseTypes'

const MVP_TYPES = [
  ObstacleType.RedWallLeft,
  ObstacleType.RedWallRight,
  ObstacleType.RedWallCenter,
  ObstacleType.HighLaser,
  ObstacleType.BlueOrb,
  ObstacleType.Meteor,
]

type SpawnableObstacleType = (typeof MVP_TYPES)[number]

function createSpawnEnabledState(): Record<SpawnableObstacleType, boolean> {
  return {
    [ObstacleType.RedWallLeft]: true,
    [ObstacleType.RedWallRight]: true,
    [ObstacleType.RedWallCenter]: true,
    [ObstacleType.HighLaser]: true,
    [ObstacleType.BlueOrb]: true,
    [ObstacleType.Meteor]: true,
  }
}

export class GameManager {
  private state: GameState = GameState.Loading
  private countdownTime = 0
  private spawnTimer = 0
  private spawnTimestamp = 0
  private lastBlueOrbSpawnTime = -Infinity
  private obstacles: Obstacle[] = []
  private thrownOrbs: ThrownOrb[] = []
  private spawnEnabled = createSpawnEnabledState()
  private blueOrbTouchPolicy: BlueOrbTouchPolicy = {
    allowTouch: true,
    suppressTouchForOrbIds: new Set<string>(),
  }
  readonly score = new ScoreManager()
  readonly difficulty = new DifficultyManager()
  private collision = new CollisionSystem()

  getState(): GameState {
    return this.state
  }

  getObstacles(): readonly Obstacle[] {
    return this.obstacles
  }

  getThrownOrbs(): readonly ThrownOrb[] {
    return this.thrownOrbs
  }

  getBlueOrbTouchPolicy(): BlueOrbTouchPolicy {
    return this.blueOrbTouchPolicy
  }

  getSpawnEnabled(): Readonly<Record<SpawnableObstacleType, boolean>> {
    return this.spawnEnabled
  }

  toggleSpawnType(type: SpawnableObstacleType): boolean {
    this.spawnEnabled[type] = !this.spawnEnabled[type]
    return this.spawnEnabled[type]
  }

  setCameraPermission(): void {
    if (this.state === GameState.Loading) {
      this.state = GameState.CameraPermission
    }
  }

  startCalibration(): void {
    if (this.state === GameState.CameraPermission || this.state === GameState.Ready) {
      this.state = GameState.Calibration
    }
  }

  completeCalibration(): void {
    if (this.state === GameState.Calibration) {
      this.state = GameState.Ready
    }
  }

  startCountdown(): void {
    if (this.state === GameState.Ready) {
      this.score.reset()
      this.difficulty.reset()
      this.obstacles = []
      this.thrownOrbs = []
      this.spawnTimer = 0
      this.spawnTimestamp = 0
      this.lastBlueOrbSpawnTime = -Infinity
      this.spawnEnabled = createSpawnEnabledState()
      this.state = GameState.Countdown
      this.countdownTime = COUNTDOWN_SECONDS
    }
  }

  startPlaying(): void {
    if (this.state === GameState.Countdown) {
      this.state = GameState.Playing
    }
  }

  endGame(): void {
    if (this.state === GameState.Playing) {
      this.state = GameState.GameOver
    }
  }

  showResult(): void {
    if (this.state === GameState.GameOver) {
      this.state = GameState.Result
    }
  }

  restart(): void {
    if (this.state === GameState.GameOver || this.state === GameState.Result) {
      this.score.reset()
      this.difficulty.reset()
      this.obstacles = []
      this.thrownOrbs = []
      this.spawnTimer = 0
      this.spawnTimestamp = 0
      this.lastBlueOrbSpawnTime = -Infinity
      this.spawnEnabled = createSpawnEnabledState()
      this.state = GameState.Ready
    }
  }

  recalibrate(): void {
    if (
      this.state === GameState.Ready ||
      this.state === GameState.Playing ||
      this.state === GameState.GameOver ||
      this.state === GameState.Result
    ) {
      this.obstacles = []
      this.thrownOrbs = []
      this.state = GameState.Calibration
    }
  }

  update(dt: number): void {
    if (this.state === GameState.Countdown) {
      this.countdownTime -= dt
      if (this.countdownTime <= 0) {
        this.state = GameState.Playing
      }
    }

    if (this.state === GameState.Playing) {
      this.score.updateTimer(dt)
      this.difficulty.update(dt)

      if (this.score.isDead || this.score.isTimeUp) {
        this.state = GameState.GameOver
        return
      }

      this.spawnTimer += dt
      if (this.spawnTimer >= this.difficulty.spawnInterval) {
        this.spawnTimer -= this.difficulty.spawnInterval
        this.spawnTimestamp += this.difficulty.spawnInterval
        this.spawnObstacle()
      }

      for (const o of this.obstacles) {
        o.update(dt)
      }

      for (const orb of this.thrownOrbs) {
        orb.update(dt)
      }

      // Detect expired BlueOrbs before filtering
      for (const o of this.obstacles) {
        if (
          o.type === ObstacleType.BlueOrb &&
          !o.active &&
          !o.resolved &&
          ((o as BlueOrb).interactionState === 'free' || (o as BlueOrb).interactionState === 'candidate')
        ) {
          this.score.registerMiss()
          o.resolved = true
        }
      }

      this.obstacles = this.obstacles.filter((o) => o.active)
      this.thrownOrbs = this.thrownOrbs.filter((o) => o.active || !o.resolved || o.result !== null)
    }
  }

  evaluateCollisions(action: PlayerAction, pose: PoseData, timestamp: number): void {
    if (this.state === GameState.Playing) {
      this.collision.evaluate(this.obstacles, action, pose, this.score, timestamp, this.blueOrbTouchPolicy)
    }
  }

  updateHandInteractions(handTracker: HandTracker, viewportWidth: number, viewportHeight: number): void {
    if (this.state !== GameState.Playing) return

    const blueOrbs = this.obstacles.filter((o): o is BlueOrb => o.type === ObstacleType.BlueOrb)
    const suppressedOrbIds = new Set<string>()
    const handsAvailable = handTracker.states.some((hand) => hand.present || hand.phase === 'pinching' || hand.phase === 'grabbed')

    for (const orb of blueOrbs) {
      if (orb.interactionState === 'free' || orb.interactionState === 'candidate') {
        orb.setCandidate(false)
      }
    }

    for (const hand of handTracker.states) {
      const grabbedOrb = blueOrbs.find((orb) => orb.interactionState === 'grabbed' && orb.grabbedBy === hand.handedness)

      if (grabbedOrb) {
        suppressedOrbIds.add(grabbedOrb.id)

        if (hand.phase === 'grabbed' || hand.present) {
          grabbedOrb.followHand(hand.x, hand.y, viewportWidth, viewportHeight)
        }

        if (hand.justReleased || (!hand.present && grabbedOrb.interactionState === 'grabbed')) {
          this.releaseGrabbedOrb(grabbedOrb, hand)
        }
        continue
      }

      const candidate = this.findNearestOrb(blueOrbs, hand)
      if (candidate) {
        candidate.setCandidate(true)
        suppressedOrbIds.add(candidate.id)
      }

      if (candidate && hand.justGrabbed) {
        candidate.attachToHand(hand.handedness, hand.x, hand.y, viewportWidth, viewportHeight)
        suppressedOrbIds.add(candidate.id)
      }
    }

    this.blueOrbTouchPolicy = {
      allowTouch: !handsAvailable,
      suppressTouchForOrbIds: suppressedOrbIds,
    }

    this.collision.evaluateThrownOrbHits(this.thrownOrbs, this.obstacles, this.score)
  }

  getCountdownNumber(): string {
    const remaining = Math.ceil(this.countdownTime)
    if (remaining <= 0) return 'GO!'
    return String(remaining)
  }

  private spawnObstacle(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const speed = this.difficulty.speed
    const enabledTypes = MVP_TYPES.filter((type) => this.spawnEnabled[type])
    const timeSinceBlueOrb = this.spawnTimestamp - this.lastBlueOrbSpawnTime

    if (enabledTypes.length === 0) {
      return
    }

    const enabledSafeTypes = enabledTypes.filter((type) => !this.difficulty.isDangerous(type))
    const enabledNonBlueOrbTypes = enabledTypes.filter((type) => type !== ObstacleType.BlueOrb)
    const enabledSafeNonBlueOrbTypes = enabledSafeTypes.filter((type) => type !== ObstacleType.BlueOrb)

    // Fairness guard: if too soon for dangerous, force BlueOrb
    let type = enabledTypes[Math.floor(Math.random() * enabledTypes.length)]
    if (this.spawnEnabled[ObstacleType.BlueOrb] && timeSinceBlueOrb >= BLUE_ORB_FORCE_GAP_SEC) {
      type = ObstacleType.BlueOrb
    }

    if (type === ObstacleType.BlueOrb && timeSinceBlueOrb < BLUE_ORB_MIN_GAP_SEC && enabledNonBlueOrbTypes.length > 0) {
      type = enabledNonBlueOrbTypes[Math.floor(Math.random() * enabledNonBlueOrbTypes.length)]
    }

    if (this.difficulty.isDangerous(type) && !this.difficulty.canSpawnDangerous(this.spawnTimestamp)) {
      if (this.spawnEnabled[ObstacleType.BlueOrb]) {
        if (timeSinceBlueOrb >= BLUE_ORB_MIN_GAP_SEC) {
          type = ObstacleType.BlueOrb
        } else if (enabledSafeNonBlueOrbTypes.length > 0) {
          type = enabledSafeNonBlueOrbTypes[Math.floor(Math.random() * enabledSafeNonBlueOrbTypes.length)]
        } else if (enabledSafeTypes.length > 0) {
          type = enabledSafeTypes[Math.floor(Math.random() * enabledSafeTypes.length)]
        } else {
          return
        }
      } else if (enabledSafeTypes.length > 0) {
        type = enabledSafeTypes[Math.floor(Math.random() * enabledSafeTypes.length)]
      } else {
        return
      }
    }

    let obstacle: Obstacle
    switch (type) {
      case ObstacleType.RedWallLeft:
        obstacle = new RedWallLeft(w, h, speed)
        this.difficulty.markDangerousSpawned(this.spawnTimestamp)
        break
      case ObstacleType.RedWallRight:
        obstacle = new RedWallRight(w, h, speed)
        this.difficulty.markDangerousSpawned(this.spawnTimestamp)
        break
      case ObstacleType.RedWallCenter:
        obstacle = new RedWallCenter(w, h, speed)
        this.difficulty.markDangerousSpawned(this.spawnTimestamp)
        break
      case ObstacleType.HighLaser:
        obstacle = new HighLaser(w, h, speed)
        this.difficulty.markDangerousSpawned(this.spawnTimestamp)
        break
      case ObstacleType.BlueOrb:
        obstacle = new BlueOrb(w, h, speed)
        this.lastBlueOrbSpawnTime = this.spawnTimestamp
        break
      case ObstacleType.Meteor:
        obstacle = new Meteor(w, h, speed)
        this.difficulty.markDangerousSpawned(this.spawnTimestamp)
        break
    }

    this.obstacles.push(obstacle)
  }

  debugSpawnBlueOrb(): boolean {
    if (!this.spawnEnabled[ObstacleType.BlueOrb]) {
      return false
    }

    const w = window.innerWidth
    const h = window.innerHeight
    this.lastBlueOrbSpawnTime = this.spawnTimestamp
    this.obstacles.push(new BlueOrb(w, h, this.difficulty.speed))
    return true
  }

  private findNearestOrb(orbs: readonly BlueOrb[], hand: TrackedHandState): BlueOrb | null {
    if (!hand.present || (hand.phase !== 'pinching' && hand.phase !== 'grabbed')) return null

    let nearest: BlueOrb | null = null
    let nearestDist = Infinity
    for (const orb of orbs) {
      if (orb.resolved || !orb.active) continue
      if (orb.interactionState !== 'free' && orb.interactionState !== 'candidate') continue

      const dist = Math.hypot(orb.centerX - hand.x, orb.centerY - hand.y)
      if (dist <= HAND_GRAB_RADIUS_PX && dist < nearestDist) {
        nearest = orb
        nearestDist = dist
      }
    }
    return nearest
  }

  private releaseGrabbedOrb(orb: BlueOrb, hand: TrackedHandState): void {
    const scale = VANISHING_POINT_FOCAL_LENGTH / (VANISHING_POINT_FOCAL_LENGTH + orb.worldZ)
    const isIntentionalThrow = hand.speed >= HAND_THROW_SPEED_THRESHOLD
    const baseFactor = isIntentionalThrow
      ? THROWN_ORB_BASE_SPEED_SCALE
      : THROWN_ORB_WEAK_TOSS_FACTOR
    const upwardLift = isIntentionalThrow
      ? THROWN_ORB_THROW_UPWARD_LIFT
      : THROWN_ORB_UPWARD_LIFT

    const velocityX = (hand.vx / scale) * baseFactor
    const velocityY = ((hand.vy / scale) * baseFactor) - upwardLift
    const velocityZ = isIntentionalThrow
      ? HAND_THROW_Z_VELOCITY
      : HAND_THROW_Z_VELOCITY * 0.45

    this.thrownOrbs.push(
      new ThrownOrb(
        hand.handedness,
        orb.worldX,
        orb.worldY,
        orb.worldZ,
        velocityX,
        velocityY,
        velocityZ,
      ),
    )

    orb.releaseToThrow()
  }
}
