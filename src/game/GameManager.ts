import { GameState } from './GameState'
import {
  COUNTDOWN_SECONDS,
  HAND_GRAB_RADIUS_PX,
  HAND_THROW_SPEED_THRESHOLD,
  HAND_THROW_Z_VELOCITY,
  THROWN_ORB_BASE_SPEED_SCALE,
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
import { CollisionSystem } from '../collision/CollisionSystem'
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

export class GameManager {
  private state: GameState = GameState.Loading
  private countdownTime = 0
  private spawnTimer = 0
  private spawnTimestamp = 0
  private lastBlueOrbSpawnTime = -Infinity
  private obstacles: Obstacle[] = []
  private thrownOrbs: ThrownOrb[] = []
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
      this.collision.evaluate(this.obstacles, action, pose, this.score, timestamp)
    }
  }

  updateHandInteractions(handTracker: HandTracker, viewportWidth: number, viewportHeight: number): void {
    if (this.state !== GameState.Playing) return

    const blueOrbs = this.obstacles.filter((o): o is BlueOrb => o.type === ObstacleType.BlueOrb)

    for (const orb of blueOrbs) {
      if (orb.interactionState === 'free' || orb.interactionState === 'candidate') {
        orb.setCandidate(false)
      }
    }

    for (const hand of handTracker.states) {
      const grabbedOrb = blueOrbs.find((orb) => orb.interactionState === 'grabbed' && orb.grabbedBy === hand.handedness)

      if (grabbedOrb) {
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
      }

      if (candidate && hand.justGrabbed) {
        candidate.attachToHand(hand.handedness, hand.x, hand.y, viewportWidth, viewportHeight)
      }
    }

    this.collision.evaluateThrownOrbHits(this.thrownOrbs, this.obstacles, this.score)
    this.collision.evaluateThrownOrbVsLaser(this.thrownOrbs, this.obstacles)
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

    // Fairness guard: if too soon for dangerous, force BlueOrb
    let type = MVP_TYPES[Math.floor(Math.random() * MVP_TYPES.length)]
    if (this.spawnTimestamp - this.lastBlueOrbSpawnTime >= 4.0) {
      type = ObstacleType.BlueOrb
    }
    if (this.difficulty.isDangerous(type) && !this.difficulty.canSpawnDangerous(this.spawnTimestamp)) {
      type = ObstacleType.BlueOrb
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

  debugSpawnBlueOrb(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.lastBlueOrbSpawnTime = this.spawnTimestamp
    this.obstacles.push(new BlueOrb(w, h, this.difficulty.speed))
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
    const baseFactor = hand.speed >= HAND_THROW_SPEED_THRESHOLD
      ? THROWN_ORB_BASE_SPEED_SCALE
      : THROWN_ORB_WEAK_TOSS_FACTOR

    const velocityX = (hand.vx / scale) * baseFactor
    const velocityY = (hand.vy / scale) * baseFactor
    const velocityZ = hand.speed >= HAND_THROW_SPEED_THRESHOLD
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
