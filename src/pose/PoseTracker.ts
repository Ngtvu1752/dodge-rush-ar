import type { PoseData } from './PoseTypes'
import type { AIWorkerManager } from '../workers/AIWorkerManager'

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

/**
 * Thin proxy that delegates pose detection to the AI Web Worker.
 * No longer runs MediaPipe inference on the main thread.
 */
export class PoseTracker {
  private manager: AIWorkerManager | null = null

  attach(manager: AIWorkerManager): void {
    this.manager = manager
  }

  get ready(): boolean {
    return this.manager?.ready ?? false
  }

  get error(): string {
    return this.manager?.error ?? ''
  }

  /** Request a new pose detection from the worker (non-blocking). */
  requestDetect(video: HTMLVideoElement, timestamp: number): void {
    this.manager?.sendFrame(video, timestamp)
  }

  /** Read the latest completed pose result from the worker. */
  readLatest(timestamp: number): PoseData {
    if (!this.manager) {
      return { ...EMPTY_POSE, timestamp }
    }
    const pose = this.manager.lastPose
    // Update timestamp to current frame so PoseSmoother grace period works
    return { ...pose, timestamp }
  }
}
