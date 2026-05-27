import type * as vision from '@mediapipe/tasks-vision'
import type { HandData, SingleHand } from '../AITypes'

const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task'

export class HandModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private landmarker: any = null
  private _ready = false
  private _error = ''

  async init(
    visionModule: typeof vision,
    fileset: Awaited<ReturnType<typeof visionModule.FilesetResolver.forVisionTasks>>,
  ): Promise<boolean> {
    try {
      console.info('[Worker] Loading HandModel...')
      const { HandLandmarker } = visionModule

      try {
        this.landmarker = await HandLandmarker.createFromModelPath(fileset, MODEL_PATH)
        await this.landmarker.setOptions({
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45,
          minHandPresenceConfidence: 0.4,
        })
        console.info('[Worker] HandModel ready (CPU).')
      } catch (cpuErr) {
        console.warn('[Worker] HandModel CPU init failed:', cpuErr)
        throw cpuErr
      }

      this._ready = true
      return true
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load HandModel'
      console.error('[Worker] HandModel init failed:', this._error)
      return false
    }
  }

  get ready(): boolean {
    return this._ready
  }

  get error(): string {
    return this._error
  }

  estimate(
    canvas: OffscreenCanvasRenderingContext2D,
    timestamp: number,
  ): { hands: HandData | null; ms: number } {
    if (!this.landmarker) return { hands: null, ms: 0 }

    const start = performance.now()
    try {
      const result = this.landmarker.detectForVideo(canvas.canvas, timestamp) as {
        landmarks?: Array<Array<{ x: number; y: number; z: number }>>
        handednesses?: Array<Array<{ categoryName?: string; score?: number }>>
      }

      if (!result.landmarks || result.landmarks.length === 0) {
        return { hands: null, ms: performance.now() - start }
      }

      let mappedLeft: SingleHand | null = null
      let mappedRight: SingleHand | null = null

      for (let i = 0; i < result.landmarks.length; i++) {
        const landmarks = result.landmarks[i]
        const handedness = result.handednesses?.[i]?.[0]
        const hand = {
          landmarks: landmarks.map((landmark) => ({
            x: landmark.x,
            y: landmark.y,
            z: landmark.z,
            visibility: 1,
          })),
          handedness: (handedness?.categoryName === 'Left' ? 'Left' : 'Right') as 'Left' | 'Right',
          confidence: handedness?.score ?? 0.5,
        } satisfies SingleHand

        if (hand.handedness === 'Left') {
          mappedLeft = hand
        } else {
          mappedRight = hand
        }
      }

      return {
        hands: {
          left: mappedLeft,
          right: mappedRight,
          timestamp,
        },
        ms: performance.now() - start,
      }
    } catch {
      return { hands: null, ms: performance.now() - start }
    }
  }

  close(): void {
    if (this.landmarker?.close) {
      this.landmarker.close()
    }
    this.landmarker = null
    this._ready = false
  }
}
