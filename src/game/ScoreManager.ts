import {
  MAX_HEALTH,
  GAME_DURATION_SEC,
  COMBO_THRESHOLDS,
  MULTIPLIERS,
} from '../config/gameConfig'

export class ScoreManager {
  score = 0
  combo = 0
  bestCombo = 0
  multiplier = MULTIPLIERS[0]
  health = MAX_HEALTH
  elapsed = 0
  successes = 0
  fails = 0
  misses = 0

  get remaining(): number {
    return Math.max(GAME_DURATION_SEC - this.elapsed, 0)
  }

  get isDead(): boolean {
    return this.health <= 0
  }

  get isTimeUp(): boolean {
    return this.remaining <= 0
  }

  reset(): void {
    this.score = 0
    this.combo = 0
    this.bestCombo = 0
    this.multiplier = MULTIPLIERS[0]
    this.health = MAX_HEALTH
    this.elapsed = 0
    this.successes = 0
    this.fails = 0
    this.misses = 0
  }

  updateTimer(dt: number): void {
    this.elapsed += dt
  }

  registerSuccess(basePoints: number): void {
    this.score += Math.round(basePoints * this.multiplier)
    this.combo++
    if (this.combo > this.bestCombo) {
      this.bestCombo = this.combo
    }
    this.updateMultiplier()
    this.successes++
  }

  registerFail(): void {
    this.health--
    this.combo = 0
    this.multiplier = MULTIPLIERS[0]
    this.fails++
  }

  registerMiss(): void {
    this.combo = 0
    this.multiplier = MULTIPLIERS[0]
    this.misses++
  }

  private updateMultiplier(): void {
    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.combo >= COMBO_THRESHOLDS[i]) {
        this.multiplier = MULTIPLIERS[i]
        return
      }
    }
  }
}
