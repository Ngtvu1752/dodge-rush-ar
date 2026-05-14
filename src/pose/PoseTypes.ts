export type Point = {
  x: number
  y: number
  z?: number
  visibility?: number
}

export type PoseData = {
  nose: Point
  leftShoulder: Point
  rightShoulder: Point
  leftElbow: Point
  rightElbow: Point
  leftWrist: Point
  rightWrist: Point
  leftHip: Point
  rightHip: Point
  leftKnee: Point
  rightKnee: Point
  leftAnkle: Point
  rightAnkle: Point
  detected: boolean
  timestamp: number
}
