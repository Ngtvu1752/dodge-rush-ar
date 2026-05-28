import type { UIContext } from '../UIOverlay'
import gsap from 'gsap'

export class MenuScreen {
  private root: HTMLElement
  private overlay: HTMLDivElement
  private content: HTMLDivElement
  private currentState = ''
  private currentCalibrationStatus = ''
  private currentLoadingMessage = ''

  constructor(root: HTMLElement) {
    this.root = root

    this.overlay = document.createElement('div')
    this.overlay.className = 'menu-overlay'
    this.overlay.style.display = 'none'

    this.content = document.createElement('div')
    this.content.className = 'menu-content glass-panel'
    this.overlay.appendChild(this.content)

    this.root.appendChild(this.overlay)
  }

  update(ctx: UIContext): void {
    const state = ctx.state
    const calibrationChanged = state === 'Calibration' && ctx.calibrationStatus !== this.currentCalibrationStatus
    const loadingChanged = (state === 'Loading' || state === 'CameraPermission') && ctx.loadingMessage !== this.currentLoadingMessage
    if (state === this.currentState && !calibrationChanged && !loadingChanged) return
    this.currentState = state
    this.currentCalibrationStatus = ctx.calibrationStatus
    this.currentLoadingMessage = ctx.loadingMessage

    if (state === 'Playing' || state === 'Countdown') {
      this.overlay.style.display = 'none'
      return
    }

    this.overlay.style.display = ''
    this.content.innerHTML = ''

    switch (state) {
      case 'Loading':
      case 'CameraPermission':
        this.renderLoading(ctx)
        break
      case 'Calibration':
        this.renderCalibration(ctx)
        break
      case 'Ready':
        this.renderReady()
        break
      case 'GameOver':
        this.renderGameOver(ctx)
        break
      case 'Result':
        this.renderResult(ctx)
        break
    }

    gsap.fromTo(this.content, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.5)' })
  }

  private renderLoading(ctx: UIContext): void {
    const hasError = ctx.cameraError || ctx.loadingMessage.includes('failed') || ctx.loadingMessage.includes('crashed')
    const message = (ctx.cameraError || ctx.loadingMessage || 'Requesting camera access...').replace(/\n/g, '<br>')
    this.content.innerHTML = `
      <h1 class="menu-title">Dodge Rush AR</h1>
      <p class="menu-text ${hasError ? 'text-error' : ''}">${message}</p>
      ${!hasError && ctx.loadingMessage ? '<div class="loading-spinner"></div>' : ''}
    `
  }

  private renderCalibration(ctx: UIContext): void {
    const pct = Math.round(ctx.calibrationProgress * 100)
    const statusText = ctx.calibrationStatus === 'idle'
      ? 'Press C to start calibration'
      : ctx.calibrationStatus === 'collecting'
        ? 'Hold still...'
        : 'Calibration complete!'

    this.content.innerHTML = `
      <h1 class="menu-title">Calibration</h1>
      <p class="menu-text text-accent">${statusText}</p>
      ${ctx.calibrationStatus === 'collecting' ? `
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${pct}%"></div>
        </div>
        <p class="menu-text text-glow">${pct}%</p>
      ` : ''}
      <p class="menu-hint">Stand in frame, shoulders and hips visible</p>
    `
  }

  private renderReady(): void {
    this.content.innerHTML = `
      <h1 class="menu-title">Dodge Rush AR</h1>
      <p class="menu-text text-accent pulse-glow">Press SPACE to Start</p>
      <p class="menu-hint">Press C to Recalibrate</p>
      <div class="instruction-cards">
        <div class="instruction-card glass-panel">
          <span class="card-icon">LR</span>
          <span class="card-text">Dodge red walls</span>
        </div>
        <div class="instruction-card glass-panel">
          <span class="card-icon">SQ</span>
          <span class="card-text">Squat under lasers</span>
        </div>
        <div class="instruction-card glass-panel">
          <span class="card-icon">ORB</span>
          <span class="card-text">Touch or grab blue orbs</span>
        </div>
      </div>
    `
  }

  private renderGameOver(ctx: UIContext): void {
    this.content.innerHTML = `
      <h1 class="menu-title text-error">Game Over</h1>
      <p class="menu-text text-gold score-big">${ctx.score}</p>
      <p class="menu-hint">Press SPACE to Continue</p>
    `
  }

  private renderResult(ctx: UIContext): void {
    this.content.innerHTML = `
      <h1 class="menu-title">Result</h1>
      <p class="menu-text text-glow score-big">${ctx.score}</p>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">Best Combo</span><span class="stat-value">${ctx.bestCombo}</span></div>
        <div class="stat"><span class="stat-label">Successes</span><span class="stat-value text-success">${ctx.successes}</span></div>
        <div class="stat"><span class="stat-label">Fails</span><span class="stat-value text-error">${ctx.fails}</span></div>
        <div class="stat"><span class="stat-label">Misses</span><span class="stat-value">${ctx.misses}</span></div>
        <div class="stat"><span class="stat-label">Level</span><span class="stat-value">${ctx.difficulty}</span></div>
      </div>
      <p class="menu-text text-accent pulse-glow">Press SPACE to Restart</p>
      <p class="menu-hint">Press C to Recalibrate</p>
    `
  }

  updateCalibrationProgress(ctx: UIContext): void {
    if (ctx.state === 'Calibration' && ctx.calibrationStatus === 'collecting') {
      const pct = Math.round(ctx.calibrationProgress * 100)
      const fill = this.content.querySelector('.progress-bar-fill') as HTMLElement | null
      if (fill) fill.style.width = `${pct}%`
      const pctText = this.content.querySelector('.text-glow') as HTMLElement | null
      if (pctText) pctText.textContent = `${pct}%`
    }
  }

  showCountdown(value: string): void {
    this.overlay.style.display = ''
    this.content.innerHTML = `<h1 class="countdown-text ${value === 'GO!' ? 'text-glow' : ''}">${value}</h1>`
    this.currentState = 'Countdown'
    gsap.fromTo(this.content, { scale: 2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' })
  }

  hide(): void {
    this.overlay.style.display = 'none'
    this.currentState = ''
  }

  dispose(): void {
    this.overlay.remove()
  }
}
