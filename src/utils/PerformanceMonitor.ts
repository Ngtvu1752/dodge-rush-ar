import type { AISchedulerStatus, RuntimeProfile } from '../workers/AITypes'

export type PerformanceSnapshot = {
  fps: number
  frameMs: number
  aiMs: number
  budgetExceeded: boolean
  runtimeProfile: RuntimeProfile
}

export class PerformanceMonitor {
  private frameTimes: number[] = []
  private lastTimestamp = 0
  private snapshot: PerformanceSnapshot = {
    fps: 0,
    frameMs: 0,
    aiMs: 0,
    budgetExceeded: false,
    runtimeProfile: 'balanced',
  }

  update(timestamp: number, schedulerStatus: AISchedulerStatus | null, runtimeProfile: RuntimeProfile): void {
    if (this.lastTimestamp > 0) {
      const dt = Math.max(0, timestamp - this.lastTimestamp)
      this.frameTimes.push(dt)
      while (this.frameTimes.length > 30) this.frameTimes.shift()
    }
    this.lastTimestamp = timestamp

    const averageFrameMs = this.frameTimes.length > 0
      ? this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length
      : 0

    this.snapshot = {
      fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
      frameMs: averageFrameMs,
      aiMs: schedulerStatus?.lastTotalMs ?? 0,
      budgetExceeded: schedulerStatus?.budgetExceeded ?? false,
      runtimeProfile,
    }
  }

  getSnapshot(): PerformanceSnapshot {
    return this.snapshot
  }
}

