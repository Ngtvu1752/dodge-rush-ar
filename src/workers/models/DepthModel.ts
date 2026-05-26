import type { DepthMapData } from '../AITypes'

const SEGMENTATION_WIDTH = 256
const SEGMENTATION_HEIGHT = 256
const FAR_DEPTH = 1.0

/**
 * Depth estimation via MediaPipe ImageSegmenter.
 * Uses the selfie_multiclass_256x256 model to extract a body segmentation mask,
 * then converts it to a depth proxy buffer (body=near, background=far).
 */
export class DepthModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private segmenter: any = null
  private _ready = false
  private _error = ''
  private depthBuffer = new Float32Array(SEGMENTATION_WIDTH * SEGMENTATION_HEIGHT)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async init(getVision: () => Promise<any>): Promise<boolean> {
    try {
      console.info('[Worker] Loading DepthModel (ImageSegmenter)...')
      const vision = await getVision()
      const { FilesetResolver, ImageSegmenter } = vision

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
        true,
      )

      const modelPath =
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'
      const opts = {
        runningMode: 'VIDEO' as const,
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }

      try {
        this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
          ...opts,
        })
        console.info('[Worker] DepthModel ready (GPU).')
      } catch (gpuErr) {
        console.warn('[Worker] DepthModel GPU failed, trying CPU:', gpuErr)
        this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
          ...opts,
        })
        console.info('[Worker] DepthModel ready (CPU).')
      }

      this._ready = true
      return true
    } catch (err) {
      this._error = err instanceof Error ? err.message : 'Failed to load ImageSegmenter'
      console.error('[Worker] DepthModel init failed:', this._error)
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
  ): { depthMap: DepthMapData; ms: number } | null {
    if (!this.segmenter) return null

    const start = performance.now()

    try {
      const result = this.segmenter.segmentForVideo(canvas.canvas, timestamp) as {
        confidenceMasks?: { getAsFloat32Array(): Float32Array; close(): void }[]
      }

      if (!result.confidenceMasks || result.confidenceMasks.length === 0) {
        return null
      }

      const mask = result.confidenceMasks[0]
      const confidence = mask.getAsFloat32Array()

      for (let i = 0; i < confidence.length; i++) {
        this.depthBuffer[i] = FAR_DEPTH - confidence[i]
      }

      mask.close()

      const ms = performance.now() - start
      const transferred = new Float32Array(this.depthBuffer)

      return {
        depthMap: {
          buffer: transferred,
          width: SEGMENTATION_WIDTH,
          height: SEGMENTATION_HEIGHT,
          timestamp,
        },
        ms,
      }
    } catch {
      return null
    }
  }

  close(): void {
    if (this.segmenter?.close) {
      this.segmenter.close()
    }
    this.segmenter = null
    this._ready = false
  }
}
