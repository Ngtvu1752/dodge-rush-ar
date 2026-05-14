import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Point, PoseData } from './PoseTypes'

const MEDIAPIPE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const

const EMPTY_POSE: PoseData = {
  nose: { x: 0, y: 0 },
  leftShoulder: { x: 0, y: 0 },
  rightShoulder: { x: 0, y: 0 },
  leftElbow: { x: 0, y: 0 },
  rightElbow: { x: 0, y: 0 },
  leftWrist: { x: 0, y: 0 },
  rightWrist: { x: 0, y: 0 },
  leftHip: { x: 0, y: 0 },
  rightHip: { x: 0, y: 0 },
  leftKnee: { x: 0, y: 0 },
  rightKnee: { x: 0, y: 0 },
  leftAnkle: { x: 0, y: 0 },
  rightAnkle: { x: 0, y: 0 },
  detected: false,
  timestamp: 0,
}

export class PoseTracker {
  private landmarker: PoseLandmarker | null = null
  private _ready = false
  private _error = ''

  async init(): Promise<boolean> {
    try {
      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      )

      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })

      this._ready = true
      return true
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load PoseLandmarker'
      console.error('PoseTracker init failed:', this._error)
      return false
    }
  }

  get ready(): boolean {
    return this._ready
  }

  get error(): string {
    return this._error
  }

  detect(video: HTMLVideoElement, timestamp: number): PoseData {
    if (!this.landmarker || video.readyState < 2) {
      return { ...EMPTY_POSE, timestamp }
    }

    try {
      const result = this.landmarker.detectForVideo(video, timestamp)
      if (!result.landmarks || result.landmarks.length === 0) {
        return { ...EMPTY_POSE, timestamp }
      }

      const lm = result.landmarks[0]

      const toPoint = (idx: number): Point => ({
        x: lm[idx].x,
        y: lm[idx].y,
        z: lm[idx].z,
        visibility: lm[idx].visibility,
      })

      return {
        nose: toPoint(MEDIAPIPE_LANDMARKS.NOSE),
        leftShoulder: toPoint(MEDIAPIPE_LANDMARKS.LEFT_SHOULDER),
        rightShoulder: toPoint(MEDIAPIPE_LANDMARKS.RIGHT_SHOULDER),
        leftElbow: toPoint(MEDIAPIPE_LANDMARKS.LEFT_ELBOW),
        rightElbow: toPoint(MEDIAPIPE_LANDMARKS.RIGHT_ELBOW),
        leftWrist: toPoint(MEDIAPIPE_LANDMARKS.LEFT_WRIST),
        rightWrist: toPoint(MEDIAPIPE_LANDMARKS.RIGHT_WRIST),
        leftHip: toPoint(MEDIAPIPE_LANDMARKS.LEFT_HIP),
        rightHip: toPoint(MEDIAPIPE_LANDMARKS.RIGHT_HIP),
        leftKnee: toPoint(MEDIAPIPE_LANDMARKS.LEFT_KNEE),
        rightKnee: toPoint(MEDIAPIPE_LANDMARKS.RIGHT_KNEE),
        leftAnkle: toPoint(MEDIAPIPE_LANDMARKS.LEFT_ANKLE),
        rightAnkle: toPoint(MEDIAPIPE_LANDMARKS.RIGHT_ANKLE),
        detected: true,
        timestamp,
      }
    } catch {
      return { ...EMPTY_POSE, timestamp }
    }
  }
}
