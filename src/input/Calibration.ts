import type { PoseData } from '../pose/PoseTypes'
import {
  CALIBRATION_DURATION_MS,
  DODGE_THRESHOLD_MULTIPLIER,
  SQUAT_THRESHOLD_MULTIPLIER,
} from '../config/gameConfig'

export type CalibrationData = {
  neutralCenterX: number
  standingHipY: number
  standingShoulderY: number
  shoulderWidth: number
  torsoHeight: number
  dodgeThreshold: number
  squatThreshold: number
}

type CalibrationState = 'idle' | 'collecting' | 'done'

export class Calibration {
  private state: CalibrationState = 'idle'
  private startTime = 0
  private sampleCount = 0
  private sumLeftShoulderX = 0
  private sumRightShoulderX = 0
  private sumShoulderY = 0
  private sumHipCenterX = 0
  private sumHipY = 0
  private result: CalibrationData | null = null

  get status(): CalibrationState {
    return this.state
  }

  get data(): CalibrationData | null {
    return this.result
  }

  get progress(): number {
    if (this.state !== 'collecting') return 0
    return Math.min((performance.now() - this.startTime) / CALIBRATION_DURATION_MS, 1)
  }

  reset(): void {
    this.state = 'idle'
    this.sampleCount = 0
    this.result = null
  }

  start(): void {
    this.state = 'collecting'
    this.startTime = performance.now()
    this.sampleCount = 0
    this.sumLeftShoulderX = 0
    this.sumRightShoulderX = 0
    this.sumShoulderY = 0
    this.sumHipCenterX = 0
    this.sumHipY = 0
  }

  feed(pose: PoseData): boolean {
    if (this.state !== 'collecting') return false

    if (!pose.detected) return false

    const ls = pose.leftShoulder
    const rs = pose.rightShoulder
    const lh = pose.leftHip
    const rh = pose.rightHip

    if ((ls.visibility ?? 0) < 0.5 || (rs.visibility ?? 0) < 0.5) return false
    if ((lh.visibility ?? 0) < 0.5 || (rh.visibility ?? 0) < 0.5) return false

    if (performance.now() - this.startTime < CALIBRATION_DURATION_MS) {
      this.sumLeftShoulderX += ls.x
      this.sumRightShoulderX += rs.x
      this.sumShoulderY += (ls.y + rs.y) / 2
      this.sumHipCenterX += (lh.x + rh.x) / 2
      this.sumHipY += (lh.y + rh.y) / 2
      this.sampleCount++
      return false
    }

    this.finish()
    return true
  }

  private finish(): void {
    if (this.sampleCount === 0) {
      this.state = 'idle'
      return
    }

    const n = this.sampleCount
    const avgLeftShoulderX = this.sumLeftShoulderX / n
    const avgRightShoulderX = this.sumRightShoulderX / n
    const avgShoulderY = this.sumShoulderY / n
    const avgHipCenterX = this.sumHipCenterX / n
    const avgHipY = this.sumHipY / n
    const shoulderWidth = Math.abs(avgRightShoulderX - avgLeftShoulderX)
    const torsoHeight = Math.abs(avgHipY - avgShoulderY)

    this.result = {
      neutralCenterX: avgHipCenterX,
      standingHipY: avgHipY,
      standingShoulderY: avgShoulderY,
      shoulderWidth,
      torsoHeight,
      dodgeThreshold: shoulderWidth * DODGE_THRESHOLD_MULTIPLIER,
      squatThreshold: torsoHeight * SQUAT_THRESHOLD_MULTIPLIER,
    }

    this.state = 'done'
  }
}
