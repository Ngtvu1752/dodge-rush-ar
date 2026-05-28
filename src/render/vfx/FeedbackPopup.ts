import gsap from 'gsap'

interface FeedbackEntry {
  element: HTMLDivElement
  timeline: gsap.core.Timeline
}

type FeedbackPopupOptions = {
  fontSizeRem?: number
  travelY?: number
  duration?: number
  glowColor?: string
  weight?: number
  letterSpacingPx?: number
}

export class FeedbackPopup {
  private root: HTMLElement
  private entries: FeedbackEntry[] = []

  constructor(root: HTMLElement) {
    this.root = root
  }

  show(text: string, color: string, x?: number, y?: number, options?: FeedbackPopupOptions): void {
    const {
      fontSizeRem = 2,
      travelY = -100,
      duration = 1.0,
      glowColor = color,
      weight = 900,
      letterSpacingPx = 1.2,
    } = options ?? {}

    const el = document.createElement('div')
    el.textContent = text
    el.style.cssText = `
      position: absolute;
      left: ${x ?? window.innerWidth / 2}px;
      top: ${y ?? window.innerHeight * 0.35}px;
      transform: translate(-50%, -50%);
      color: ${color};
      font-family: 'Nunito', 'Segoe UI', system-ui, sans-serif;
      font-weight: ${weight};
      font-size: ${fontSizeRem}rem;
      letter-spacing: ${letterSpacingPx}px;
      text-shadow: 0 0 18px ${glowColor}, 0 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      white-space: nowrap;
      z-index: 100;
    `
    this.root.appendChild(el)

    const tl = gsap.timeline({
      onComplete: () => {
        el.remove()
        this.entries = this.entries.filter((entry) => entry.element !== el)
      },
    })

    tl.from(el, {
      scale: 0.28,
      opacity: 0,
      duration: 0.16,
      ease: 'back.out(3.2)',
    })
    tl.to(el, {
      y: travelY,
      opacity: 0,
      duration,
      ease: 'power1.out',
    }, 0.08)

    this.entries.push({ element: el, timeline: tl })
  }

  dispose(): void {
    for (const entry of this.entries) {
      entry.timeline.kill()
      entry.element.remove()
    }
    this.entries = []
  }
}
