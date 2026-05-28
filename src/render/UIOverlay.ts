import type { Renderer } from './Renderer'
import type { GameState } from '../game/GameState'
import type { DifficultyLevel } from '../game/DifficultyManager'

export type UIContext = {
  state: GameState
  score: number
  combo: number
  bestCombo: number
  multiplier: number
  health: number
  maxHealth: number
  remaining: number
  successes: number
  fails: number
  misses: number
  difficulty: DifficultyLevel
  countdown: string
  calibrationStatus: string
  calibrationProgress: number
  cameraError: string
  loadingMessage: string
  debug: boolean
  handTrackingStatus: string
  pinchStatus: string
  grabStatus: string
  throwReady: boolean
  runtimeStatus: string
}

type FeedbackEntry = {
  text: string
  color: string
  startTime: number
}

const FEEDBACK_DURATION_MS = 1200

export class UIOverlay {
  private feedbacks: FeedbackEntry[] = []

  showFeedback(text: string, color: string): void {
    this.feedbacks.push({ text, color, startTime: performance.now() })
  }

  render(r: Renderer, ctx: UIContext): void {
    const now = performance.now()
    this.feedbacks = this.feedbacks.filter((f) => now - f.startTime < FEEDBACK_DURATION_MS)

    switch (ctx.state) {
      case 'Loading':
      case 'CameraPermission':
        this.renderLoading(r, ctx)
        break
      case 'Calibration':
        this.renderCalibration(r, ctx)
        break
      case 'Ready':
        this.renderReady(r, ctx)
        break
      case 'Countdown':
        this.renderCountdown(r, ctx)
        break
      case 'Playing':
        this.renderPlaying(r, ctx)
        break
      case 'GameOver':
        this.renderGameOver(r, ctx)
        break
      case 'Result':
        this.renderResult(r, ctx)
        break
    }
  }

  private renderLoading(r: Renderer, ctx: UIContext): void {
    this.drawOverlayBg(r)
    this.drawTitle(r, r.height * 0.35)

    if (ctx.cameraError) {
      this.drawTextShadow(r, ctx.cameraError, r.width / 2, r.height * 0.5, {
        size: 22,
        color: '#ff6666',
      })
    } else {
      this.drawTextShadow(r, 'Requesting camera access...', r.width / 2, r.height * 0.5, {
        size: 22,
        color: '#cccccc',
      })
    }
  }

  private renderCalibration(r: Renderer, ctx: UIContext): void {
    this.drawOverlayBg(r)

    this.drawTextShadow(r, 'Calibration', r.width / 2, r.height * 0.25, {
      size: 36,
      color: '#ffffff',
    })

    if (ctx.calibrationStatus === 'idle') {
      this.drawTextShadow(r, 'Press C to start calibration', r.width / 2, r.height * 0.4, {
        size: 24,
        color: '#88ff88',
      })
      this.drawTextShadow(r, 'Stand in frame', r.width / 2, r.height * 0.5, {
        size: 20,
        color: '#cccccc',
      })
      this.drawTextShadow(r, 'Make sure shoulders and hips are visible', r.width / 2, r.height * 0.55, {
        size: 18,
        color: '#aaaaaa',
      })
    } else if (ctx.calibrationStatus === 'collecting') {
      this.drawTextShadow(r, 'Hold still for calibration...', r.width / 2, r.height * 0.4, {
        size: 24,
        color: '#ffffff',
      })

      const pct = Math.round(ctx.calibrationProgress * 100)
      this.drawTextShadow(r, `${pct}%`, r.width / 2, r.height * 0.5, {
        size: 56,
        color: '#00ff88',
      })

      // Progress bar
      const barW = r.width * 0.4
      const barH = 8
      const barX = (r.width - barW) / 2
      const barY = r.height * 0.57
      r.drawRect(barX, barY, barW, barH, '#333333', '#666666', 1)
      r.drawRect(barX, barY, barW * ctx.calibrationProgress, barH, '#00ff88', undefined)
    }
  }

  private renderReady(r: Renderer, _ctx: UIContext): void {
    this.drawOverlayBg(r)

    this.drawTitle(r, r.height * 0.2)

    this.drawTextShadow(r, 'Press SPACE to Start', r.width / 2, r.height * 0.4, {
      size: 28,
      color: '#00ff88',
    })

    this.drawTextShadow(r, 'Press C to Recalibrate', r.width / 2, r.height * 0.47, {
      size: 18,
      color: '#aaaaaa',
    })

    // How-to-play
    const instructions = [
      'Move left/right to dodge red walls',
      'Squat under orange lasers',
      'Touch blue orbs with your hands',
    ]
    instructions.forEach((line, i) => {
      this.drawTextShadow(r, line, r.width / 2, r.height * 0.6 + i * 28, {
        size: 18,
        color: '#cccccc',
      })
    })
  }

  private renderCountdown(r: Renderer, ctx: UIContext): void {
    const isGo = ctx.countdown === 'GO!'
    this.drawTextShadow(r, ctx.countdown, r.width / 2, r.height / 2, {
      size: 120,
      color: isGo ? '#00ff88' : '#ffffff',
    })
  }

  private renderPlaying(r: Renderer, ctx: UIContext): void {
    // HUD - top right
    const rx = r.width - 16
    this.drawTextShadow(r, `Score: ${ctx.score}`, rx, 16, {
      size: 20,
      color: '#ffcc00',
      align: 'right',
      baseline: 'top',
    })
    this.drawTextShadow(r, `Combo: ${ctx.combo}  x${ctx.multiplier.toFixed(1)}`, rx, 42, {
      size: 18,
      color: '#ffffff',
      align: 'right',
      baseline: 'top',
    })
    this.drawTextShadow(r, `Level: ${ctx.difficulty}`, rx, 66, {
      size: 16,
      color: '#88ccff',
      align: 'right',
      baseline: 'top',
    })

    // HUD - top left
    const lx = 16
    const hearts = '♥'.repeat(Math.max(ctx.health, 0))
    this.drawTextShadow(r, hearts, lx, 16, {
      size: 22,
      color: '#ff4444',
      align: 'left',
      baseline: 'top',
    })
    this.drawTextShadow(r, `${Math.ceil(ctx.remaining)}s`, lx, 44, {
      size: 20,
      color: '#ffffff',
      align: 'left',
      baseline: 'top',
    })

    // Feedback text
    this.renderFeedbacks(r)
  }

  private renderGameOver(r: Renderer, ctx: UIContext): void {
    this.drawOverlayBg(r)

    this.drawTextShadow(r, 'Game Over', r.width / 2, r.height * 0.35, {
      size: 56,
      color: '#ff4444',
    })

    this.drawTextShadow(r, `Final Score: ${ctx.score}`, r.width / 2, r.height * 0.5, {
      size: 32,
      color: '#ffcc00',
    })

    this.drawTextShadow(r, 'Press SPACE to Continue', r.width / 2, r.height * 0.65, {
      size: 22,
      color: '#ffffff',
    })
  }

  private renderResult(r: Renderer, ctx: UIContext): void {
    this.drawOverlayBg(r)

    this.drawTextShadow(r, 'Result', r.width / 2, r.height * 0.12, {
      size: 48,
      color: '#ffffff',
    })

    this.drawTextShadow(r, `Score: ${ctx.score}`, r.width / 2, r.height * 0.24, {
      size: 36,
      color: '#00ff88',
    })

    const stats = [
      `Best Combo: ${ctx.bestCombo}`,
      `Successes: ${ctx.successes}`,
      `Fails: ${ctx.fails}`,
      `Misses: ${ctx.misses}`,
      `Level: ${ctx.difficulty}`,
    ]

    stats.forEach((line, i) => {
      this.drawTextShadow(r, line, r.width / 2, r.height * 0.35 + i * 28, {
        size: 20,
        color: '#cccccc',
      })
    })

    this.drawTextShadow(r, 'Press SPACE to Restart', r.width / 2, r.height * 0.65, {
      size: 22,
      color: '#ffffff',
    })
    this.drawTextShadow(r, 'Press C to Recalibrate', r.width / 2, r.height * 0.72, {
      size: 18,
      color: '#aaaaaa',
    })
  }

  private renderFeedbacks(r: Renderer): void {
    const now = performance.now()
    const cx = r.width / 2
    const baseY = r.height * 0.35

    this.feedbacks.forEach((fb, i) => {
      const age = now - fb.startTime
      const yOffset = -age * 0.03  // Float upward

      this.drawTextShadow(r, fb.text, cx, baseY + yOffset + i * 40, {
        size: 36,
        color: fb.color,
      })
    })
  }

  private drawTitle(r: Renderer, y: number): void {
    this.drawTextShadow(r, 'Dodge Rush AR', r.width / 2, y, {
      size: 48,
      color: '#ffffff',
    })
  }

  private drawOverlayBg(r: Renderer): void {
    r.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
    r.ctx.fillRect(0, 0, r.width, r.height)
  }

  private drawTextShadow(
    r: Renderer,
    text: string,
    x: number,
    y: number,
    options?: {
      size?: number
      color?: string
      align?: CanvasTextAlign
      baseline?: CanvasTextBaseline
    },
  ): void {
    const { size = 24, color = '#ffffff', align = 'center', baseline = 'middle' } = options ?? {}

    r.ctx.save()
    r.ctx.font = `bold ${size}px system-ui, sans-serif`
    r.ctx.textAlign = align
    r.ctx.textBaseline = baseline

    // Shadow for contrast
    r.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    r.ctx.shadowBlur = 6
    r.ctx.shadowOffsetX = 2
    r.ctx.shadowOffsetY = 2

    r.ctx.fillStyle = color
    r.ctx.fillText(text, x, y)

    r.ctx.restore()
  }
}
