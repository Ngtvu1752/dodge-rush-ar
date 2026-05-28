import {
  DIFFICULTY_EASY_END,
  DIFFICULTY_MEDIUM_END,
  DIFFICULTY_SPEED_EASY,
  DIFFICULTY_SPEED_MEDIUM,
  DIFFICULTY_SPEED_HARD,
  DIFFICULTY_INTERVAL_EASY,
  DIFFICULTY_INTERVAL_MEDIUM,
  DIFFICULTY_INTERVAL_HARD,
  FAIRNESS_DANGEROUS_GAP_SEC,
} from '../config/gameConfig'
import { ObstacleType } from '../entities/Obstacle'

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard'

export class DifficultyManager {
  private elapsed = 0
  private lastDangerousSpawnTime = -Infinity
  private prevLevel: DifficultyLevel = 'Easy'

  onDifficultyChange?: (level: DifficultyLevel) => void

  get level(): DifficultyLevel {
    if (this.elapsed < DIFFICULTY_EASY_END) return 'Easy'
    if (this.elapsed < DIFFICULTY_MEDIUM_END) return 'Medium'
    return 'Hard'
  }

  get speed(): number {
    if (this.elapsed < DIFFICULTY_EASY_END) return DIFFICULTY_SPEED_EASY
    if (this.elapsed < DIFFICULTY_MEDIUM_END) return DIFFICULTY_SPEED_MEDIUM
    return DIFFICULTY_SPEED_HARD
  }

  get spawnInterval(): number {
    if (this.elapsed < DIFFICULTY_EASY_END) return DIFFICULTY_INTERVAL_EASY
    if (this.elapsed < DIFFICULTY_MEDIUM_END) return DIFFICULTY_INTERVAL_MEDIUM
    return DIFFICULTY_INTERVAL_HARD
  }

  update(dt: number): void {
    this.elapsed += dt
    const current = this.level
    if (current !== this.prevLevel) {
      this.prevLevel = current
      this.onDifficultyChange?.(current)
    }
  }

  reset(): void {
    this.elapsed = 0
    this.lastDangerousSpawnTime = -Infinity
    this.prevLevel = 'Easy'
  }

  canSpawnDangerous(timestamp: number): boolean {
    return timestamp - this.lastDangerousSpawnTime >= FAIRNESS_DANGEROUS_GAP_SEC
  }

  markDangerousSpawned(timestamp: number): void {
    this.lastDangerousSpawnTime = timestamp
  }

  isDangerous(type: ObstacleType): boolean {
    return type === ObstacleType.RedWallLeft ||
      type === ObstacleType.RedWallCenter ||
      type === ObstacleType.RedWallRight ||
      type === ObstacleType.HighLaser ||
      type === ObstacleType.Meteor
  }
}
