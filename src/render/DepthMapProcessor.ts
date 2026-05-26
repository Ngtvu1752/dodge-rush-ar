import type { DepthMapData } from '../workers/AITypes'

/**
 * V2-05: Temporal smoothing + Gaussian blur for depth maps.
 *
 * Maintains a ring buffer of the last 2 depth maps and interpolates
 * between them based on timestamps. Applies a 3×3 Gaussian blur to
 * smooth blocky edges from the low-res AI depth map.
 */
export class DepthMapProcessor {
  private history: [DepthMapData | null, DepthMapData | null] = [null, null]
  private writeIndex = 0
  private processed: Float32Array | null = null
  private processedWidth = 0
  private processedHeight = 0

  /**
   * Push a new depth map into the ring buffer.
   */
  push(depthMap: DepthMapData): void {
    this.history[this.writeIndex] = {
      buffer: new Float32Array(depthMap.buffer),
      width: depthMap.width,
      height: depthMap.height,
      timestamp: depthMap.timestamp,
    }
    this.writeIndex = 1 - this.writeIndex
  }

  /**
   * Get the smoothed/interpolated depth map for the current time.
   *
   * If only one depth map exists, returns it (possibly blurred).
   * If two exist, interpolates between them based on `now` vs their timestamps.
   * Always applies 3×3 Gaussian blur to smooth blocky edges.
   */
  process(now: number): DepthMapData | null {
    const [a, b] = this.history

    if (!a && !b) return null

    const latest = a && b
      ? (a.timestamp > b.timestamp ? a : b)
      : a ?? b!

    // If only one depth map, just blur and return
    if (!a || !b) {
      return this.blur(latest)
    }

    // Interpolation factor: how far `now` is between the two depth map timestamps
    const older = a.timestamp < b.timestamp ? a : b
    const newer = a.timestamp < b.timestamp ? b : a

    if (newer.timestamp === older.timestamp) {
      return this.blur(newer)
    }

    const t = Math.max(0, Math.min(1, (now - older.timestamp) / (newer.timestamp - older.timestamp)))

    return this.interpolateAndBlur(older, newer, t)
  }

  /**
   * Linearly interpolate between two depth maps and apply Gaussian blur.
   */
  private interpolateAndBlur(a: DepthMapData, b: DepthMapData, t: number): DepthMapData {
    const w = a.width
    const h = a.height

    if (w !== b.width || h !== b.height) {
      return this.blur(a.timestamp > b.timestamp ? a : b)
    }

    if (!this.processed || this.processedWidth !== w || this.processedHeight !== h) {
      this.processed = new Float32Array(w * h)
      this.processedWidth = w
      this.processedHeight = h
    }

    const out = this.processed
    const bufA = a.buffer
    const bufB = b.buffer
    const invT = 1 - t

    // Interpolate
    for (let i = 0; i < w * h; i++) {
      out[i] = bufA[i] * invT + bufB[i] * t
    }

    // Apply 3×3 Gaussian blur in-place (using temp buffer)
    this.gaussianBlur3x3(out, w, h)

    return {
      buffer: out,
      width: w,
      height: h,
      timestamp: a.timestamp + (b.timestamp - a.timestamp) * t,
    }
  }

  /**
   * Apply 3×3 Gaussian blur to a single depth map.
   *
   * Kernel:
   *   1 2 1
   *   2 4 2   / 16
   *   1 2 1
   */
  private blur(depthMap: DepthMapData): DepthMapData {
    const { buffer, width, height } = depthMap

    if (!this.processed || this.processedWidth !== width || this.processedHeight !== height) {
      this.processed = new Float32Array(width * height)
      this.processedWidth = width
      this.processedHeight = height
    }

    const out = this.processed
    this.gaussianBlur3x3(buffer, width, height, out)

    return {
      buffer: out,
      width,
      height,
      timestamp: depthMap.timestamp,
    }
  }

  /**
   * In-place 3×3 Gaussian blur. Reads from `src`, writes to `dst`.
   * If `dst` is omitted, uses a temporary buffer and copies back.
   */
  private gaussianBlur3x3(
    src: Float32Array,
    w: number,
    h: number,
    dst?: Float32Array,
  ): void {
    const tmp = dst ?? new Float32Array(w * h)
    const useTmp = !dst
    const target = useTmp ? tmp : dst!

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        let weight = 0

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue

            // Gaussian kernel weights: 1,2,1 / 2,4,2 / 1,2,1
            const kernelWeight =
              (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1)

            sum += src[ny * w + nx] * kernelWeight
            weight += kernelWeight
          }
        }

        // Clamp to [0, 1] to prevent extreme outliers
        target[y * w + x] = Math.max(0, Math.min(1, sum / weight))
      }
    }

    // If no dst provided, copy back to src
    if (useTmp) {
      src.set(tmp)
    }
  }

  dispose(): void {
    this.history = [null, null]
    this.processed = null
  }
}
