import { GameState } from './GameState'
import { COUNTDOWN_SECONDS } from '../config/gameConfig'
import { ScoreManager } from './ScoreManager'
import { DifficultyManager } from './DifficultyManager'
import { type Obstacle, ObstacleType } from '../entities/Obstacle'
import { RedWallCenter, RedWallLeft, RedWallRight } from '../entities/RedWall'
import { HighLaser } from '../entities/HighLaser'
import { BlueOrb } from '../entities/BlueOrb'
import { Meteor } from '../entities/Meteor'
import { CollisionSystem } from '../collision/CollisionSystem'
import type { PlayerAction } from '../input/GestureDetector'
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
  private obstacles: Obstacle[] = []
  readonly score = new ScoreManager()
  readonly difficulty = new DifficultyManager()
  private collision = new CollisionSystem()

  getState(): GameState {
    return this.state
  }

  getObstacles(): readonly Obstacle[] {
    return this.obstacles
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
      this.spawnTimer = 0
      this.spawnTimestamp = 0
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
      this.spawnTimer = 0
      this.spawnTimestamp = 0
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

      // Detect expired BlueOrbs before filtering
      for (const o of this.obstacles) {
        if (o.type === ObstacleType.BlueOrb && !o.active && !o.resolved) {
          this.score.registerMiss()
          o.resolved = true
        }
      }

      this.obstacles = this.obstacles.filter((o) => o.active)
    }
  }

  evaluateCollisions(action: PlayerAction, pose: PoseData, timestamp: number): void {
    if (this.state === GameState.Playing) {
      this.collision.evaluate(this.obstacles, action, pose, this.score, timestamp)
    }
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
    this.obstacles.push(new BlueOrb(w, h, this.difficulty.speed))
  }
}
