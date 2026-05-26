/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import * as vision from '@mediapipe/tasks-vision'
import type { Point, PoseData } from '../pose/PoseTypes'
import type {
  AIFrameRequest,
  AICommand,
  AIWorkerOutMessage,
  ModelType,
  AISetModelsCommand,
  DepthMapData,
} from './AITypes'
import { InferenceScheduler } from './InferenceScheduler'
import { DepthModel } from './models/DepthModel'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

async function getVisionModule(): Promise<typeof vision> {
  return vision
}

// ── MediaPipe landmark indices ──
const LM = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let landmarker: any = null
const scheduler = new InferenceScheduler()
const depthModel = new DepthModel()

// Reusable OffscreenCanvas to avoid per-frame allocation
let reusableCanvas: OffscreenCanvas | null = null
let reusableCtx: OffscreenCanvasRenderingContext2D | null = null

function ensureCanvas(width: number, height: number): OffscreenCanvasRenderingContext2D {
  if (!reusableCanvas || reusableCanvas.width !== width || reusableCanvas.height !== height) {
    reusableCanvas = new OffscreenCanvas(width, height)
    reusableCtx = reusableCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  }
  return reusableCtx!
}

function toPoint(lm: { x: number; y: number; z: number; visibility?: number }[], idx: number): Point {
  const p = lm[idx]
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    visibility: p.visibility,
  }
}

function mapResults(
  result: { landmarks?: { x: number; y: number; z: number; visibility?: number }[][] },
  timestamp: number,
): PoseData | null {
  if (!result.landmarks || result.landmarks.length === 0) {
    return null
  }

  const lm = result.landmarks[0]
  return {
    nose: toPoint(lm, LM.NOSE),
    leftShoulder: toPoint(lm, LM.LEFT_SHOULDER),
    rightShoulder: toPoint(lm, LM.RIGHT_SHOULDER),
    leftElbow: toPoint(lm, LM.LEFT_ELBOW),
    rightElbow: toPoint(lm, LM.RIGHT_ELBOW),
    leftWrist: toPoint(lm, LM.LEFT_WRIST),
    rightWrist: toPoint(lm, LM.RIGHT_WRIST),
    leftHip: toPoint(lm, LM.LEFT_HIP),
    rightHip: toPoint(lm, LM.RIGHT_HIP),
    leftKnee: toPoint(lm, LM.LEFT_KNEE),
    rightKnee: toPoint(lm, LM.RIGHT_KNEE),
    leftAnkle: toPoint(lm, LM.LEFT_ANKLE),
    rightAnkle: toPoint(lm, LM.RIGHT_ANKLE),
    detected: true,
    timestamp,
  }
}

async function initPoseLandmarker(): Promise<void> {
  console.info('[Worker] Loading WASM fileset (ESM)...')
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL, true)
  console.info('[Worker] WASM fileset loaded.')

  const modelPath =
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

  try {
    console.info('[Worker] Creating PoseLandmarker with GPU...')
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    console.info('[Worker] PoseLandmarker ready (GPU).')
  } catch (gpuErr) {
    console.warn('[Worker] GPU failed, trying CPU:', gpuErr)
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    console.info('[Worker] PoseLandmarker ready (CPU).')
  }
}

// ── Per-model inference ──

function runPoseInference(
  ctx: OffscreenCanvasRenderingContext2D,
  timestamp: number,
): { pose: PoseData | null; ms: number } {
  if (!landmarker) return { pose: null, ms: 0 }

  const start = performance.now()
  let pose: PoseData | null = null

  try {
    const result = landmarker.detectForVideo(ctx.canvas, timestamp) as {
      landmarks?: { x: number; y: number; z: number; visibility?: number }[][]
    }
    pose = mapResults(result, timestamp)
  } catch {
    pose = null
  }

  return { pose, ms: performance.now() - start }
}

function runHandsInference(
  _ctx: OffscreenCanvasRenderingContext2D,
  _timestamp: number,
): { ms: number } {
  return { ms: 0 }
}

function runDepthInference(
  ctx: OffscreenCanvasRenderingContext2D,
  timestamp: number,
): { depthMap: DepthMapData | null; ms: number } {
  if (!depthModel.ready) return { depthMap: null, ms: 0 }
  const result = depthModel.estimate(ctx, timestamp)
  if (!result) return { depthMap: null, ms: 0 }
  return { depthMap: result.depthMap, ms: result.ms }
}

// ── Main frame processing ──

function processFrame(data: AIFrameRequest): void {
  const { bitmap, timestamp } = data

  const batch = scheduler.getNextBatch(timestamp)
  const enabledSet = new Set(scheduler.enabledModels)
  const modelsSkipped = (['pose', 'hands', 'depth'] as ModelType[]).filter(
    (m) => enabledSet.has(m) && !batch.includes(m),
  )

  const ctx = ensureCanvas(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const inferenceMs: Record<ModelType, number> = { pose: 0, hands: 0, depth: 0 }
  let pose: PoseData | null = null
  let depthMap: DepthMapData | null = null

  for (const model of batch) {
    if (model === 'pose') {
      const result = runPoseInference(ctx, timestamp)
      pose = result.pose
      inferenceMs.pose = result.ms
    } else if (model === 'hands') {
      const result = runHandsInference(ctx, timestamp)
      inferenceMs.hands = result.ms
    } else if (model === 'depth') {
      const result = runDepthInference(ctx, timestamp)
      depthMap = result.depthMap
      inferenceMs.depth = result.ms
    }
  }

  scheduler.recordResults(batch, inferenceMs, timestamp)

  const result: AIWorkerOutMessage = {
    type: 'result',
    timestamp,
    pose,
    depthMap,
    inferenceMs,
    modelsRan: batch,
    modelsSkipped,
  }
  self.postMessage(result)

  const status = scheduler.buildStatus(batch, modelsSkipped)
  self.postMessage(status)
}

// ── Lazy model loading ──

async function ensureModelLoaded(model: ModelType): Promise<void> {
  if (model === 'depth' && !depthModel.ready) {
    await depthModel.init(getVisionModule)
  }
}

async function handleSetModels(data: AISetModelsCommand): Promise<void> {
  for (const [key, enabled] of Object.entries(data.models)) {
    if (enabled !== undefined) {
      const model = key as ModelType
      scheduler.setModelEnabled(model, enabled)
      if (enabled) {
        await ensureModelLoaded(model)
      }
    }
  }
}

// ── Message handler ──
self.onmessage = async (e: MessageEvent<AICommand | AIFrameRequest>) => {
  const data = e.data

  if (data.type === 'init') {
    try {
      await initPoseLandmarker()
      const msg: AIWorkerOutMessage = { type: 'ready' }
      self.postMessage(msg)
    } catch (err) {
      const errorMsg = err instanceof Error ? `${err.name}: ${err.message}` : 'Worker init failed'
      console.error('[Worker] Init failed:', errorMsg, err)
      const msg: AIWorkerOutMessage = { type: 'error', error: errorMsg }
      self.postMessage(msg)
    }
    return
  }

  if (data.type === 'frame') {
    processFrame(data)
    return
  }

  if (data.type === 'setModels') {
    await handleSetModels(data)
    return
  }

  if (data.type === 'destroy') {
    landmarker?.close()
    landmarker = null
    depthModel.close()
  }
}
