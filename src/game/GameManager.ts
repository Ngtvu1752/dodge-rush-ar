import { GameState } from './GameState'
import { COUNTDOWN_SECONDS, OBSTACLE_SPAWN_INTERVAL, OBSTACLE_SPEED } from '../config/gameConfig'
import { ScoreManager } from './ScoreManager'
import { type Obstacle, ObstacleType, HighLaser, BlueOrb } from '../entities/Obstacle'
import { RedWallLeft, RedWallRight } from '../entities/RedWall'

const MVP_TYPES = [
  ObstacleType.RedWallLeft,
  ObstacleType.RedWallRight,
  ObstacleType.HighLaser,
  ObstacleType.BlueOrb,
]

export class GameManager {
  private state: GameState = GameState.Loading
  private countdownTime = 0
  private spawnTimer = 0
  private obstacles: Obstacle[] = []
  readonly score = new ScoreManager()

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
      this.obstacles = []
      this.spawnTimer = 0
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
      this.obstacles = []
      this.spawnTimer = 0
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

      if (this.score.isDead || this.score.isTimeUp) {
        this.state = GameState.GameOver
        return
      }

      this.spawnTimer += dt
      if (this.spawnTimer >= OBSTACLE_SPAWN_INTERVAL) {
        this.spawnTimer -= OBSTACLE_SPAWN_INTERVAL
        this.spawnObstacle()
      }

      for (const o of this.obstacles) {
        o.update(dt)
      }
      this.obstacles = this.obstacles.filter((o) => o.active)
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
    const type = MVP_TYPES[Math.floor(Math.random() * MVP_TYPES.length)]

    let obstacle: Obstacle
    switch (type) {
      case ObstacleType.RedWallLeft:
        obstacle = new RedWallLeft(w, h, OBSTACLE_SPEED)
        break
      case ObstacleType.RedWallRight:
        obstacle = new RedWallRight(w, h, OBSTACLE_SPEED)
        break
      case ObstacleType.HighLaser:
        obstacle = new HighLaser(w, h, OBSTACLE_SPEED)
        break
      case ObstacleType.BlueOrb:
        obstacle = new BlueOrb(w, h, OBSTACLE_SPEED)
        break
    }

    this.obstacles.push(obstacle)
  }
}
