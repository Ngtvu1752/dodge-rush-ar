import type { ModelType, AISchedulerStatus, RuntimeProfile } from './AITypes'

const MODEL_PRIORITY: Record<ModelType, number> = {
  pose: 1,
  hands: 2,
  depth: 3,
}

const PROFILE_SETTINGS: Record<RuntimeProfile, {
  budgetMs: number
  intervalMs: Record<ModelType, number>
  depthIntervalHandsActiveMs: number
}> = {
  balanced: {
    budgetMs: 45,
    intervalMs: {
      pose: 0,
      hands: 20,
      depth: 66,
    },
    depthIntervalHandsActiveMs: 110,
  },
  fallback: {
    budgetMs: 36,
    intervalMs: {
      pose: 0,
      hands: 33,
      depth: 140,
    },
    depthIntervalHandsActiveMs: 180,
  },
}

interface ModelState {
  enabled: boolean
  priority: number
  lastRunTime: number
  lastInferenceMs: number
}

export class InferenceScheduler {
  private models: Record<ModelType, ModelState>
  private lastTotalMs = 0
  private budgetExceeded = false
  private runtimeProfile: RuntimeProfile = 'balanced'

  constructor() {
    this.models = {
      pose: {
        enabled: true,
        priority: MODEL_PRIORITY.pose,
        lastRunTime: 0,
        lastInferenceMs: 0,
      },
      hands: {
        enabled: false,
        priority: MODEL_PRIORITY.hands,
        lastRunTime: 0,
        lastInferenceMs: 0,
      },
      depth: {
        enabled: false,
        priority: MODEL_PRIORITY.depth,
        lastRunTime: 0,
        lastInferenceMs: 0,
      },
    }
  }

  setModelEnabled(model: ModelType, enabled: boolean): void {
    this.models[model].enabled = enabled
  }

  setRuntimeProfile(profile: RuntimeProfile): void {
    this.runtimeProfile = profile
  }

  getNextBatch(timestamp: number): ModelType[] {
    const batch: ModelType[] = []
    const handsEnabled = this.models.hands.enabled

    const enabled = (Object.keys(this.models) as ModelType[])
      .filter((model) => this.models[model].enabled)
      .sort((a, b) => this.models[a].priority - this.models[b].priority)

    let candidates = enabled
    if (this.budgetExceeded && enabled.length > 1) {
      candidates = handsEnabled
        ? enabled.filter((model) => model !== 'depth')
        : enabled.slice(0, -1)
    }

    for (const model of candidates) {
      const state = this.models[model]
      const intervalMs = this.getIntervalMs(model)

      if (state.priority === 1) {
        batch.push(model)
        continue
      }

      if (timestamp - state.lastRunTime >= intervalMs) {
        batch.push(model)
      }
    }

    return batch
  }

  recordResults(modelsRan: ModelType[], inferenceMs: Record<ModelType, number>, timestamp: number): void {
    let total = 0
    for (const model of modelsRan) {
      const state = this.models[model]
      state.lastRunTime = timestamp
      state.lastInferenceMs = inferenceMs[model]
      total += inferenceMs[model]
    }

    this.lastTotalMs = total
    this.budgetExceeded = total > PROFILE_SETTINGS[this.runtimeProfile].budgetMs
  }

  buildStatus(modelsRan: ModelType[], modelsSkipped: ModelType[]): AISchedulerStatus {
    return {
      type: 'schedulerStatus',
      runtimeProfile: this.runtimeProfile,
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
      effectiveIntervalsMs: {
        pose: this.getIntervalMs('pose'),
        hands: this.getIntervalMs('hands'),
        depth: this.getIntervalMs('depth'),
      },
    }
  }

  get enabledModels(): ModelType[] {
    return (Object.keys(this.models) as ModelType[]).filter((model) => this.models[model].enabled)
  }

  private getIntervalMs(model: ModelType): number {
    const profileSettings = PROFILE_SETTINGS[this.runtimeProfile]

    if (model === 'depth' && this.models.hands.enabled) {
      return profileSettings.depthIntervalHandsActiveMs
    }

    return profileSettings.intervalMs[model]
  }
}
