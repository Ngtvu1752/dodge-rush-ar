import type { DepthMapData } from '../workers/AITypes'

/**
 * Renders a depth map as a grayscale overlay on a dedicated canvas.
 * 0.0 (near/body) = white, 1.0 (far/background) = black.
 */
export class DebugDepthMap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private imageData: ImageData
  private _visible = false

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'depth-debug-canvas'
    this.canvas.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 16px;
      width: 256px;
      height: 256px;
      border: 2px solid rgba(0,200,255,0.6);
      border-radius: 8px;
      z-index: 100;
      pointer-events: none;
      display: none;
      image-rendering: pixelated;
    `
    document.body.appendChild(this.canvas)

    this.ctx = this.canvas.getContext('2d')!
    this.canvas.width = 256
    this.canvas.height = 256
    this.imageData = this.ctx.createImageData(256, 256)
  }

  get visible(): boolean {
    return this._visible
  }

  toggle(): void {
    this._visible = !this._visible
    this.canvas.style.display = this._visible ? 'block' : 'none'
  }

  setVisible(v: boolean): void {
    this._visible = v
    this.canvas.style.display = v ? 'block' : 'none'
  }

  /** Draw the depth map onto the overlay canvas. */
  draw(depthMap: DepthMapData): void {
    if (!this._visible) return

    const { buffer, width, height } = depthMap
    const data = this.imageData.data

    // Resize canvas if depth map dimensions changed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.imageData = this.ctx.createImageData(width, height)
    }

    // Convert Float32 depth (0=near/white, 1=far/black) to RGBA grayscale
    for (let i = 0; i < buffer.length; i++) {
      const v = Math.max(0, Math.min(1, buffer[i]))
      const gray = Math.round((1 - v) * 255) // Invert: near=white, far=black
      const px = i * 4
      data[px] = gray
      data[px + 1] = gray
      data[px + 2] = gray
      data[px + 3] = 200 // Slight transparency
    }

    this.ctx.putImageData(this.imageData, 0, 0)
  }

  destroy(): void {
    this.canvas.remove()
  }
}
