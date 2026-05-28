import type { PoseData } from '../pose/PoseTypes'
import type { CalibrationData } from './Calibration'

export type PlayerAction = {
  dodgeLeft: boolean
  dodgeRight: boolean
  squat: boolean
}

const EMPTY_ACTION: PlayerAction = {
  dodgeLeft: false,
  dodgeRight: false,
  squat: false,
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

    return { dodgeLeft, dodgeRight, squat }
  }
}
