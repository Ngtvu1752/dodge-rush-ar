import type { ModelType, AISchedulerStatus } from './AITypes'

// ── Priority: lower number = runs first ──
const MODEL_PRIORITY: Record<ModelType, number> = {
  pose: 1,
  hands: 2,
  depth: 3,
}

// ── Minimum interval between runs for non-priority-1 models ──
const MODEL_INTERVAL_MS: Record<ModelType, number> = {
  pose: 0,      // Always run
  hands: 20,    // ~50 FPS max
  depth: 66,    // ~15 FPS max
}
const DEPTH_INTERVAL_HANDS_ACTIVE_MS = 110

// ── Budget: if last cycle exceeded this, skip lowest-priority model ──
const INFERENCE_BUDGET_MS = 45

interface ModelState {
  enabled: boolean
  priority: number
  intervalMs: number
  lastRunTime: number
  lastInferenceMs: number
}

export class InferenceScheduler {
  private models: Record<ModelType, ModelState>
  private lastTotalMs = 0
  private budgetExceeded = false

  constructor() {
    this.models = {
      pose: {
        enabled: true,
        priority: MODEL_PRIORITY.pose,
        intervalMs: MODEL_INTERVAL_MS.pose,
        lastRunTime: 0,
        lastInferenceMs: 0,
      },
      hands: {
        enabled: false,
        priority: MODEL_PRIORITY.hands,
        intervalMs: MODEL_INTERVAL_MS.hands,
        lastRunTime: 0,
        lastInferenceMs: 0,
      },
      depth: {
        enabled: false,
        priority: MODEL_PRIORITY.depth,
        intervalMs: MODEL_INTERVAL_MS.depth,
        lastRunTime: 0,
        lastInferenceMs: 0,
      },
    }
  }

  setModelEnabled(model: ModelType, enabled: boolean): void {
    this.models[model].enabled = enabled
  }

  /** Returns ordered list of models to run this cycle. */
  getNextBatch(timestamp: number): ModelType[] {
    const batch: ModelType[] = []
    const handsEnabled = this.models.hands.enabled

    // Get all enabled models sorted by priority (pose first)
    const enabled = (Object.keys(this.models) as ModelType[])
      .filter((m) => this.models[m].enabled)
      .sort((a, b) => this.models[a].priority - this.models[b].priority)

    // Budget-aware: if last cycle exceeded budget, depth yields first while hands are active.
    let candidates = enabled
    if (this.budgetExceeded && enabled.length > 1) {
      candidates = handsEnabled
        ? enabled.filter((model) => model !== 'depth')
        : enabled.slice(0, -1)
    }

    for (const model of candidates) {
      const state = this.models[model]
      const intervalMs = this.getIntervalMs(model)

      // Priority 1 (pose) always runs
      if (state.priority === 1) {
        batch.push(model)
        continue
      }

      // Other models respect their interval
      if (timestamp - state.lastRunTime >= intervalMs) {
        batch.push(model)
      }
    }

    return batch
  }

  /** Record results from a completed inference cycle. */
  recordResults(
    modelsRan: ModelType[],
    inferenceMs: Record<ModelType, number>,
    timestamp: number,
  ): void {
    let total = 0
    for (const model of modelsRan) {
      const state = this.models[model]
      state.lastRunTime = timestamp
      state.lastInferenceMs = inferenceMs[model]
      total += inferenceMs[model]
    }
    this.lastTotalMs = total
    this.budgetExceeded = total > INFERENCE_BUDGET_MS
  }

  /** Build a status message for the main thread. */
  buildStatus(modelsRan: ModelType[], modelsSkipped: ModelType[]): AISchedulerStatus {
    return {
      type: 'schedulerStatus',
      enabled: {
        pose: this.models.pose.enabled,
        hands: this.models.hands.enabled,
        depth: this.models.depth.enabled,
      },
      inferenceMs: {
        pose: this.models.pose.lastInferenceMs,
        hands: this.models.hands.lastInferenceMs,
        depth: this.models.depth.lastInferenceMs,
      },
      lastTotalMs: this.lastTotalMs,
      budgetExceeded: this.budgetExceeded,
      modelsRan,
      modelsSkipped,
    }
  }

  get enabledModels(): ModelType[] {
    return (Object.keys(this.models) as ModelType[])
      .filter((m) => this.models[m].enabled)
  }

  private getIntervalMs(model: ModelType): number {
    if (model === 'depth' && this.models.hands.enabled) {
      return DEPTH_INTERVAL_HANDS_ACTIVE_MS
    }

    return this.models[model].intervalMs
  }
}
