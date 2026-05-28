import { SFX_ENABLED } from '../config/gameConfig'

export type SFXEvent =
  | 'dodge'
  | 'squat'
  | 'orbTouch'
  | 'orbMiss'
  | 'hit'
  | 'bullseye'
  | 'wallBreak'
  | 'meteorDown'
  | 'grab'
  | 'throw'
  | 'countdown'
  | 'countdownGo'
  | 'gameOver'
  | 'comboUp'
  | 'comboBreak'
  | 'difficultyUp'

type SoundRecipe = {
  freq: number
  endFreq?: number
  type: OscillatorType
  duration: number
  gain: number
  /** Optional second oscillator for harmonics */
  freq2?: number
  type2?: OscillatorType
  gain2?: number
}

const RECIPES: Record<SFXEvent, SoundRecipe> = {
  dodge: {
    freq: 520,
    endFreq: 780,
    type: 'sine',
    duration: 0.12,
    gain: 0.25,
  },
  squat: {
    freq: 440,
    endFreq: 660,
    type: 'sine',
    duration: 0.1,
    gain: 0.22,
  },
  orbTouch: {
    freq: 800,
    endFreq: 1200,
    type: 'triangle',
    duration: 0.15,
    gain: 0.2,
    freq2: 1200,
    type2: 'sine',
    gain2: 0.1,
  },
  orbMiss: {
    freq: 300,
    endFreq: 180,
    type: 'sawtooth',
    duration: 0.2,
    gain: 0.15,
  },
  hit: {
    freq: 150,
    type: 'square',
    duration: 0.18,
    gain: 0.3,
  },
  bullseye: {
    freq: 600,
    endFreq: 1200,
    type: 'sine',
    duration: 0.2,
    gain: 0.25,
  },
  wallBreak: {
    freq: 400,
    endFreq: 100,
    type: 'sawtooth',
    duration: 0.25,
    gain: 0.22,
  },
  meteorDown: {
    freq: 500,
    endFreq: 1000,
    type: 'sine',
    duration: 0.22,
    gain: 0.25,
    freq2: 80,
    type2: 'sine',
    gain2: 0.2,
  },
  grab: {
    freq: 600,
    type: 'sine',
    duration: 0.06,
    gain: 0.18,
  },
  throw: {
    freq: 400,
    endFreq: 800,
    type: 'sine',
    duration: 0.1,
    gain: 0.2,
  },
  countdown: {
    freq: 440,
    type: 'sine',
    duration: 0.08,
    gain: 0.2,
  },
  countdownGo: {
    freq: 880,
    type: 'sine',
    duration: 0.2,
    gain: 0.28,
  },
  gameOver: {
    freq: 400,
    endFreq: 100,
    type: 'sawtooth',
    duration: 0.6,
    gain: 0.22,
  },
  comboUp: {
    freq: 660,
    endFreq: 990,
    type: 'sine',
    duration: 0.13,
    gain: 0.22,
  },
  comboBreak: {
    freq: 200,
    type: 'square',
    duration: 0.15,
    gain: 0.2,
  },
  difficultyUp: {
    freq: 500,
    endFreq: 1000,
    type: 'triangle',
    duration: 0.3,
    gain: 0.2,
  },
}

export class SFXManager {
  private ctx: AudioContext | null = null
  private muted = false
  private enabled: boolean

  constructor() {
    this.enabled = SFX_ENABLED
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  get isMuted(): boolean {
    return this.muted
  }

  play(event: SFXEvent): void {
    if (!this.enabled || this.muted) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const recipe = RECIPES[event]
    const now = ctx.currentTime

    this.playOscillator(ctx, recipe, now)

    if (recipe.freq2 !== undefined && recipe.type2 !== undefined && recipe.gain2 !== undefined) {
      this.playOscillator(ctx, {
        freq: recipe.freq2,
        endFreq: recipe.endFreq ? recipe.freq2 * (recipe.endFreq / recipe.freq) : undefined,
        type: recipe.type2,
        duration: recipe.duration,
        gain: recipe.gain2,
      }, now)
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  private playOscillator(ctx: AudioContext, recipe: SoundRecipe, now: number): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = recipe.type
    osc.frequency.setValueAtTime(recipe.freq, now)

    if (recipe.endFreq !== undefined) {
      osc.frequency.linearRampToValueAtTime(recipe.endFreq, now + recipe.duration)
    }

    gain.gain.setValueAtTime(recipe.gain, now)
    gain.gain.linearRampToValueAtTime(0, now + recipe.duration)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + recipe.duration)
  }
}
