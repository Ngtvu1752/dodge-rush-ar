import type { UIContext } from '../UIOverlay'
import gsap from 'gsap'

export class HUDPanel {
  private root: HTMLElement
  private scoreEl: HTMLDivElement
  private comboEl: HTMLDivElement
  private levelEl: HTMLDivElement
  private timerEl: HTMLDivElement
  private handEl: HTMLDivElement
  private grabEl: HTMLDivElement
  private runtimeEl: HTMLDivElement
  private prevScore = -1
  private prevCombo = -1

  constructor(root: HTMLElement) {
    this.root = root

    const rightPanel = document.createElement('div')
    rightPanel.className = 'glass-panel hud-panel hud-right'
    rightPanel.innerHTML = `
      <div class=hud-score id=hud-score>0</div>
      <div class=hud-combo id=hud-combo>Combo: 0  x1.0</div>
      <div class=hud-level id=hud-level>Easy</div>
      <div class=hud-level id=hud-hand>Hands: SEARCHING</div>
      <div class=hud-level id=hud-grab>Grab: none</div>
      <div class=hud-level id=hud-runtime>Runtime: BALANCED</div>
    `
    this.root.appendChild(rightPanel)

    const leftPanel = document.createElement('div')
    leftPanel.className = 'glass-panel hud-panel hud-left'
    leftPanel.innerHTML = `<div class=hud-timer id=hud-timer>60s</div>`
    this.root.appendChild(leftPanel)

    this.scoreEl = rightPanel.querySelector('#hud-score')!
    this.comboEl = rightPanel.querySelector('#hud-combo')!
    this.levelEl = rightPanel.querySelector('#hud-level')!
    this.timerEl = leftPanel.querySelector('#hud-timer')!
    this.handEl = rightPanel.querySelector('#hud-hand')!
    this.grabEl = rightPanel.querySelector('#hud-grab')!
    this.runtimeEl = rightPanel.querySelector('#hud-runtime')!
  }

  update(ctx: UIContext): void {
    if (ctx.score !== this.prevScore) {
      this.scoreEl.textContent = `${ctx.score}`
      if (this.prevScore >= 0) {
        gsap.fromTo(this.scoreEl, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' })
      }
      this.prevScore = ctx.score
    }

    if (ctx.combo !== this.prevCombo) {
      this.comboEl.textContent = `Combo: ${ctx.combo}  x${ctx.multiplier.toFixed(1)}`
      if (ctx.combo >= 20) {
        this.comboEl.style.color = '#ffcc00'
        gsap.fromTo(this.comboEl, { scale: 1.5 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' })
      } else if (ctx.combo >= 10) {
        this.comboEl.style.color = '#ffa500'
        gsap.fromTo(this.comboEl, { scale: 1.3 }, { scale: 1, duration: 0.3, ease: 'back.out(2)' })
      } else {
        this.comboEl.style.color = '#ffffff'
      }
      this.prevCombo = ctx.combo
    }

    this.levelEl.textContent = ctx.difficulty
    this.timerEl.textContent = `${Math.ceil(ctx.remaining)}s`

    const handsSearching = ctx.handTrackingStatus !== 'TRACKING'
    this.handEl.textContent = handsSearching
      ? `Hands: ${ctx.handTrackingStatus}`
      : `Hands: ${ctx.throwReady ? 'THROW READY' : ctx.pinchStatus}`
    this.handEl.style.color = handsSearching
      ? '#d7dce7'
      : ctx.throwReady
        ? '#88ddff'
        : '#cfd8ff'

    this.grabEl.textContent = ctx.grabStatus.startsWith('Grabbed')
      ? ctx.grabStatus
      : `Grab: ${ctx.throwReady ? 'release to throw' : 'none'}`
    this.grabEl.style.color = ctx.grabStatus.startsWith('Grabbed')
      ? '#9df7d0'
      : '#d7dce7'

    this.runtimeEl.textContent = ctx.runtimeStatus
    this.runtimeEl.style.color = ctx.runtimeStatus.includes('FALLBACK') ? '#ffd27a' : '#b8ecff'
  }

  show(): void {
    this.root.querySelectorAll('.hud-panel').forEach((el) => {
      ;(el as HTMLElement).style.display = ''
    })
  }

  hide(): void {
    this.root.querySelectorAll('.hud-panel').forEach((el) => {
      ;(el as HTMLElement).style.display = 'none'
    })
  }

  dispose(): void {
    this.root.querySelectorAll('.hud-panel').forEach((el) => el.remove())
  }
}
