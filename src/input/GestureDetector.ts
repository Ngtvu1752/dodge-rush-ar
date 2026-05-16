import type { PoseData } from '../pose/PoseTypes'
import type { CalibrationData } from './Calibration'
import { GESTURE_HOLD_MS } from '../config/gameConfig'

export type PlayerAction = {
  dodgeLeft: boolean
  dodgeRight: boolean
  squat: boolean
  leftHandActive: boolean
  rightHandActive: boolean
  shield: boolean
  positionalSafeLeft: boolean
  positionalSafeRight: boolean
}

const EMPTY_ACTION: PlayerAction = {
  dodgeLeft: false,
  dodgeRight: false,
  squat: false,
  leftHandActive: false,
  rightHandActive: false,
  shield: false,
  positionalSafeLeft: false,
  positionalSafeRight: false,
}

type GestureKey = keyof PlayerAction

export class GestureDetector {
  private activeGesture: GestureKey | null = null
  private gestureSince = 0

  detect(pose: PoseData, calibration: CalibrationData, timestamp: number): PlayerAction {
    if (!pose.detected) {
      this.clearIfExpired(timestamp)
      return this.current()
    }

    const raw = this.computeRaw(pose, calibration)

    for (const key of Object.keys(raw) as GestureKey[]) {
      if (raw[key]) {
        if (this.activeGesture !== key) {
          this.activeGesture = key
          this.gestureSince = timestamp
        }
        return this.current()
      }
    }

    this.clearIfExpired(timestamp)
    return this.current()
  }

  private computeRaw(pose: PoseData, cal: CalibrationData): PlayerAction {
    const hipCenterX = (pose.leftHip.x + pose.rightHip.x) / 2
    const hipCenterY = (pose.leftHip.y + pose.rightHip.y) / 2
    const offset = hipCenterX - cal.neutralCenterX

    // Mirrored webcam: MediaPipe sees original frame.
    // Moving physically left → higher X in original frame → positive offset.
    const dodgeLeft = offset > cal.dodgeThreshold
    const dodgeRight = offset < -cal.dodgeThreshold

    const hipDrop = hipCenterY - cal.standingHipY
    const squat = hipDrop > cal.squatThreshold

    const vis = (v: number | undefined) => (v ?? 0.5) > 0.3

    const leftHandActive =
      vis(pose.leftWrist.visibility) &&
      pose.leftWrist.x >= 0 &&
      pose.leftWrist.x <= 1 &&
      pose.leftWrist.y >= 0 &&
      pose.leftWrist.y <= 1

    const rightHandActive =
      vis(pose.rightWrist.visibility) &&
      pose.rightWrist.x >= 0 &&
      pose.rightWrist.x <= 1 &&
      pose.rightWrist.y >= 0 &&
      pose.rightWrist.y <= 1

    const spread = cal.shoulderWidth * 0.5
    const shield =
      pose.leftWrist.x < pose.leftShoulder.x - spread &&
      pose.rightWrist.x > pose.rightShoulder.x + spread

    // Positional safety: raw offset check without hysteresis.
    // Used by CollisionSystem for "already safe" evaluation.
    const positionalSafeLeft = offset > cal.dodgeThreshold
    const positionalSafeRight = offset < -cal.dodgeThreshold

    return { dodgeLeft, dodgeRight, squat, leftHandActive, rightHandActive, shield, positionalSafeLeft, positionalSafeRight }
  }

  private clearIfExpired(timestamp: number): void {
    if (this.activeGesture && timestamp - this.gestureSince >= GESTURE_HOLD_MS) {
      this.activeGesture = null
    }
  }

  private current(): PlayerAction {
    if (!this.activeGesture) return EMPTY_ACTION
    return { ...EMPTY_ACTION, [this.activeGesture]: true }
  }
}
