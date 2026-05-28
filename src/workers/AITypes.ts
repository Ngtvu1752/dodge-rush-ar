import type { PoseData } from '../pose/PoseTypes'

// ── Model types (ordered by priority: lower number = higher priority) ──
export type ModelType = 'pose' | 'hands' | 'depth'
export type RuntimeProfile = 'balanced' | 'fallback'

// ── Hand tracking data (transferred from worker) ──
export interface HandLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export interface SingleHand {
  landmarks: HandLandmark[]
  handedness: 'Left' | 'Right'
  confidence: number
}

export interface HandData {
  left: SingleHand | null
  right: SingleHand | null
  timestamp: number
}

// ── Depth map data (transferred from worker) ──
export interface DepthMapData {
  buffer: Float32Array
  width: number
  height: number
  timestamp: number
}

// ── Main thread → Worker: video frame ──
export interface AIFrameRequest {
  type: 'frame'
  timestamp: number
  bitmap: ImageBitmap
}

// ── Main thread → Worker: lifecycle commands ──
export interface AISetModelsCommand {
  type: 'setModels'
  models: Partial<Record<ModelType, boolean>>
}

export interface AISetRuntimeProfileCommand {
  type: 'setRuntimeProfile'
  profile: RuntimeProfile
}

export type AICommand =
  | { type: 'init' }
  | { type: 'destroy' }
  | AISetModelsCommand
  | AISetRuntimeProfileCommand

// ── Worker → Main thread: inference results ──
export interface AIFrameResult {
  type: 'result'
  timestamp: number
  pose: PoseData | null
  hands: HandData | null
  depthMap: DepthMapData | null
  inferenceMs: Record<ModelType, number>
  modelsRan: ModelType[]
  modelsSkipped: ModelType[]
}

// ── Worker → Main thread: scheduler status (piggybacks on result) ──
export interface AISchedulerStatus {
  type: 'schedulerStatus'
  runtimeProfile: RuntimeProfile
  enabled: Record<ModelType, boolean>
  inferenceMs: Record<ModelType, number>
  lastTotalMs: number
  budgetExceeded: boolean
  modelsRan: ModelType[]
  modelsSkipped: ModelType[]
  effectiveIntervalsMs: Record<ModelType, number>
}

// ── Worker → Main thread: lifecycle messages ──
export interface AIReadyMessage {
  type: 'ready'
}

export interface AIErrorMessage {
  type: 'error'
  error: string
}

export type AIWorkerOutMessage =
  | AIFrameResult
  | AISchedulerStatus
  | AIReadyMessage
  | AIErrorMessage
