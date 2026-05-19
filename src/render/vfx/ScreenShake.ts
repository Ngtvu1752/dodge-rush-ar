export class ScreenShake {
  private container: HTMLElement
  private intensity = 0
  private decay = 0.85

  constructor(container: HTMLElement) {
    this.container = container
  }

  shake(intensity: number): void {
    this.intensity = Math.max(this.intensity, intensity)
  }

  apply(): void {
    if (this.intensity > 0.5) {
      const x = (Math.random() - 0.5) * this.intensity * 2
      const y = (Math.random() - 0.5) * this.intensity * 2
      this.container.style.transform = `translate(${x}px, ${y}px)`
      this.intensity *= this.decay
    } else {
      this.intensity = 0
      this.container.style.transform = ''
    }
  }
}
