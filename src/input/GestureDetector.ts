import type { PoseData } from '../pose/PoseTypes'
import type { CalibrationData } from './Calibration'

export type PlayerAction = {
  dodgeLeft: boolean
  dodgeRight: boolean
  squat: boolean
  leftHandActive: boolean
  rightHandActive: boolean
  shield: boolean
}

const EMPTY_ACTION: PlayerAction = {
  dodgeLeft: false,
  dodgeRight: false,
  squat: false,
  leftHandActive: false,
  rightHandActive: false,
  shield: false,
}

export class GestureDetector {
  detect(pose: PoseData, calibration: CalibrationData, timestamp: number): PlayerAction {
    void timestamp
    if (!pose.detected) {
      return EMPTY_ACTION
    }
    return this.computeRaw(pose, calibration)
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

    return { dodgeLeft, dodgeRight, squat, leftHandActive, rightHandActive, shield }
  }
}
