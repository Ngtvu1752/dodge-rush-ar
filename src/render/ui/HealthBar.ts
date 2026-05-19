import type { UIContext } from '../UIOverlay'
import gsap from 'gsap'

export class HealthBar {
  private root: HTMLElement
  private container: HTMLDivElement
  private heartEls: HTMLSpanElement[] = []
  private prevHealth = -1
  private maxHealth: number

  constructor(root: HTMLElement, maxHealth: number) {
    this.root = root
    this.maxHealth = maxHealth

    this.container = document.createElement('div')
    this.container.className = 'glass-panel hud-panel health-bar'
    this.root.appendChild(this.container)

    this.buildHearts(maxHealth)
  }

  private buildHearts(count: number): void {
    this.container.innerHTML = ''
    this.heartEls = []
    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span')
      heart.className = 'heart'
      heart.textContent = '♥'
      this.container.appendChild(heart)
      this.heartEls.push(heart)
    }
  }

  update(ctx: UIContext): void {
    if (ctx.health !== this.prevHealth) {
      // Animate lost hearts
      for (let i = 0; i < this.maxHealth; i++) {
        if (i >= ctx.health && i < this.prevHealth) {
          // This heart was just lost
          const el = this.heartEls[i]
          el.classList.add('heart-lost')
          gsap.fromTo(el,
            { x: -3 },
            { x: 0, duration: 0.3, ease: 'elastic.out(1, 0.3)', clearProps: 'x' },
          )
        } else if (i < ctx.health) {
          this.heartEls[i].classList.remove('heart-lost')
        }
      }
      this.prevHealth = ctx.health
    }
  }

  show(): void {
    this.container.style.display = ''
  }

  hide(): void {
    this.container.style.display = 'none'
  }

  dispose(): void {
    this.container.remove()
  }
}
