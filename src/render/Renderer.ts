export class Renderer {
  private canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  resize(): void {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  get width(): number {
    return this.canvas.width
  }

  get height(): number {
    return this.canvas.height
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.fillStyle = '#1a1a2e'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  }

  drawVideo(video: HTMLVideoElement): void {
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (vw === 0 || vh === 0) return

    this.ctx.save()
    this.ctx.translate(this.canvas.width, 0)
    this.ctx.scale(-1, 1)

    const scale = Math.max(this.canvas.width / vw, this.canvas.height / vh)
    const dw = vw * scale
    const dh = vh * scale
    const dx = (this.canvas.width - dw) / 2
    const dy = (this.canvas.height - dh) / 2

    this.ctx.drawImage(video, dx, dy, dw, dh)
    this.ctx.restore()
  }

  drawText(
    text: string,
    x: number,
    y: number,
    options?: { size?: number; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline },
  ): void {
    const { size = 24, color = '#ffffff', align = 'center', baseline = 'middle' } = options ?? {}
    this.ctx.fillStyle = color
    this.ctx.font = `${size}px system-ui`
    this.ctx.textAlign = align
    this.ctx.textBaseline = baseline
    this.ctx.fillText(text, x, y)
  }

  drawCenteredText(text: string, size: number, color = '#ffffff'): void {
    this.drawText(text, this.canvas.width / 2, this.canvas.height / 2, { size, color })
  }

  drawMultilineCentered(text: string, size: number, color = '#ffffff'): void {
    const lines = text.split('. ')
    const lineHeight = size * 1.2
    const startY = this.canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2

    this.ctx.fillStyle = color
    this.ctx.font = `${size}px system-ui`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    lines.forEach((line, i) => {
      this.ctx.fillText(line, this.canvas.width / 2, startY + i * lineHeight)
    })
  }

  drawLine(x1: number, y1: number, x2: number, y2: number, color: string, width = 2): void {
    this.ctx.beginPath()
    this.ctx.moveTo(x1, y1)
    this.ctx.lineTo(x2, y2)
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = width
    this.ctx.stroke()
  }

  drawCircle(x: number, y: number, radius: number, fillColor?: string, strokeColor?: string, strokeWidth = 2): void {
    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)

    if (fillColor) {
      this.ctx.fillStyle = fillColor
      this.ctx.fill()
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor
      this.ctx.lineWidth = strokeWidth
      this.ctx.stroke()
    }
  }

  drawRect(x: number, y: number, width: number, height: number, fillColor?: string, strokeColor?: string, strokeWidth = 2): void {
    if (fillColor) {
      this.ctx.fillStyle = fillColor
      this.ctx.fillRect(x, y, width, height)
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor
      this.ctx.lineWidth = strokeWidth
      this.ctx.strokeRect(x, y, width, height)
    }
  }
}
