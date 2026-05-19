import gsap from 'gsap'

interface FeedbackEntry {
  element: HTMLDivElement
  timeline: gsap.core.Timeline
}

export class FeedbackPopup {
  private root: HTMLElement
  private entries: FeedbackEntry[] = []

  constructor(root: HTMLElement) {
    this.root = root
  }

  show(text: string, color: string, x?: number, y?: number): void {
    const el = document.createElement('div')
    el.textContent = text
    el.style.cssText = `
      position: absolute;
      left: ${x ?? window.innerWidth / 2}px;
      top: ${y ?? window.innerHeight * 0.35}px;
      transform: translate(-50%, -50%);
      color: ${color};
      font-family: 'Nunito', 'Segoe UI', system-ui, sans-serif;
      font-weight: 900;
      font-size: 2rem;
      text-shadow: 0 0 15px ${color}, 0 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      white-space: nowrap;
      z-index: 100;
    `
    this.root.appendChild(el)

    const tl = gsap.timeline({
      onComplete: () => {
        el.remove()
        this.entries = this.entries.filter((e) => e.element !== el)
      },
    })

    // Bounce in, float up, fade out
    tl.from(el, {
      scale: 0.3,
      duration: 0.15,
      ease: 'back.out(3)',
    })
    tl.to(el, {
      y: -100,
      opacity: 0,
      duration: 1.0,
      ease: 'power1.out',
    }, 0.1)

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
