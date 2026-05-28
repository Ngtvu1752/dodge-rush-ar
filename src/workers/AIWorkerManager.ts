import type { PoseData } from '../pose/PoseTypes'
import type {
  AIFrameRequest,
  AICommand,
  AIWorkerOutMessage,
  AISchedulerStatus,
  ModelType,
  DepthMapData,
  HandData,
  RuntimeProfile,
} from './AITypes'

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

export class AIWorkerManager {
  private worker: Worker | null = null
  private _ready = false
  private _error = ''
  private _lastPose: PoseData = { ...EMPTY_POSE }
  private _lastHands: HandData | null = null
  private _lastDepthMap: DepthMapData | null = null
  private _pendingFrame = false
  private _queuedVideo: HTMLVideoElement | null = null
  private _queuedTimestamp = 0
  private _lastSchedulerStatus: AISchedulerStatus | null = null

  async init(): Promise<boolean> {
    try {
      this.worker = new Worker(
        new URL('./ai.worker.ts', import.meta.url),
        { type: 'module' },
      )

      this.worker.onmessage = (e: MessageEvent<AIWorkerOutMessage>) => {
        this.handleMessage(e.data)
      }

      this.worker.onerror = (e) => {
        this._error = e.message ?? 'Worker error'
        console.error('AIWorker error:', this._error)
      }

      return await new Promise<boolean>((resolve) => {
        const origHandler = this.worker!.onmessage
        this.worker!.onmessage = (e: MessageEvent<AIWorkerOutMessage>) => {
          const msg = e.data
          if (msg.type === 'ready') {
            this._ready = true
            this.worker!.onmessage = origHandler
            resolve(true)
          } else if (msg.type === 'error') {
            this._error = msg.error
            this.worker!.onmessage = origHandler
            resolve(false)
          }
        }

        const cmd: AICommand = { type: 'init' }
        this.worker!.postMessage(cmd)
      })
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to create worker'
      console.error('AIWorkerManager init failed:', this._error)
      return false
    }
  }

  private handleMessage(msg: AIWorkerOutMessage): void {
    if (msg.type === 'result') {
      this._pendingFrame = false
      if (msg.pose) {
        this._lastPose = msg.pose
      }
      if (msg.modelsRan.includes('hands')) {
        this._lastHands = msg.hands
      }
      if (msg.depthMap) {
        this._lastDepthMap = msg.depthMap
      }
      this.flushQueuedFrame()
    } else if (msg.type === 'schedulerStatus') {
      this._lastSchedulerStatus = msg
    } else if (msg.type === 'error') {
      this._error = msg.error
      this._pendingFrame = false
      console.error('AIWorker runtime error:', msg.error)
      this.flushQueuedFrame()
    }
  }

  sendFrame(video: HTMLVideoElement, timestamp: number): void {
    if (!this.worker || !this._ready) {
      return
    }

    if (video.readyState < 2) {
      return
    }

    if (this._pendingFrame) {
      this._queuedVideo = video
      this._queuedTimestamp = timestamp
      return
    }

    this.dispatchFrame(video, timestamp)
  }

  setModels(models: Partial<Record<ModelType, boolean>>): void {
    if (!this.worker || !this._ready) return
    if (models.hands === false) {
      this._lastHands = null
    }
    if (models.depth === false) {
      this._lastDepthMap = null
    }
    const cmd: AICommand = { type: 'setModels', models }
    this.worker.postMessage(cmd)
  }

  setRuntimeProfile(profile: RuntimeProfile): void {
    if (!this.worker || !this._ready) return
    const cmd: AICommand = { type: 'setRuntimeProfile', profile }
    this.worker.postMessage(cmd)
  }

  get lastPose(): PoseData {
    return this._lastPose
  }

  get lastDepthMap(): DepthMapData | null {
    return this._lastDepthMap
  }

  get lastHands(): HandData | null {
    return this._lastHands
  }

  get lastSchedulerStatus(): AISchedulerStatus | null {
    return this._lastSchedulerStatus
  }

  get ready(): boolean {
    return this._ready
  }

  get error(): string {
    return this._error
  }

  destroy(): void {
    if (this.worker) {
      const cmd: AICommand = { type: 'destroy' }
      this.worker.postMessage(cmd)
      this.worker = null
      this._ready = false
      this._pendingFrame = false
      this._queuedVideo = null
      this._queuedTimestamp = 0
    }
  }

  private dispatchFrame(video: HTMLVideoElement, timestamp: number): void {
    this._pendingFrame = true

    createImageBitmap(video).then((bitmap) => {
      if (!this.worker) {
        bitmap.close()
        this._pendingFrame = false
        return
      }

      const msg: AIFrameRequest = {
        type: 'frame',
        timestamp,
        bitmap,
      }
      this.worker.postMessage(msg, [bitmap])
    }).catch(() => {
      this._pendingFrame = false
      this.flushQueuedFrame()
    })
  }

  private flushQueuedFrame(): void {
    if (this._pendingFrame || !this.worker || !this._ready || !this._queuedVideo) {
      return
    }

    const video = this._queuedVideo
    const timestamp = this._queuedTimestamp
    this._queuedVideo = null
    this._queuedTimestamp = 0

    if (video.readyState < 2) {
      return
    }

    this.dispatchFrame(video, timestamp)
  }
}
