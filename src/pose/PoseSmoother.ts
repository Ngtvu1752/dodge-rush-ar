import type { Point, PoseData } from './PoseTypes'
import { SMOOTHING_FACTOR, POSE_LOSS_GRACE_MS } from '../config/gameConfig'

const LANDMARK_KEYS: (keyof PoseData)[] = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
]

function lerpPoint(prev: Point, curr: Point, factor: number): Point {
  return {
    x: prev.x + (curr.x - prev.x) * factor,
    y: prev.y + (curr.y - prev.y) * factor,
    z: (prev.z ?? 0) + ((curr.z ?? 0) - (prev.z ?? 0)) * factor,
    visibility: curr.visibility,
  }
}

function lerpPose(prev: PoseData, curr: PoseData, factor: number): PoseData {
  const result: PoseData = { ...curr }
  for (const key of LANDMARK_KEYS) {
    const k = key as keyof Pick<PoseData, typeof LANDMARK_KEYS[number]>
    result[k] = lerpPoint(prev[k] as Point, curr[k] as Point, factor) as never
  }
  return result
}

export class PoseSmoother {
  private previous: PoseData | null = null
  private lastDetectedTime = 0
  private factor: number
  private graceMs: number

  constructor(factor = SMOOTHING_FACTOR, graceMs = POSE_LOSS_GRACE_MS) {
    this.factor = factor
    this.graceMs = graceMs
  }

  smooth(raw: PoseData): PoseData {
    const now = raw.timestamp

    if (raw.detected) {
      this.lastDetectedTime = now

      if (!this.previous) {
        this.previous = { ...raw }
        return raw
      }

      const smoothed = lerpPose(this.previous, raw, this.factor)
      this.previous = smoothed
      return smoothed
    }

    if (this.previous && now - this.lastDetectedTime < this.graceMs) {
      return { ...this.previous, detected: true, timestamp: now }
    }

    this.previous = null
    return raw
  }
}
