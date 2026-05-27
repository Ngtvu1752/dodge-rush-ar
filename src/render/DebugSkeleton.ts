import type { PoseData, Point } from '../pose/PoseTypes'
import type { Renderer } from './Renderer'
import type { HandData, SingleHand } from '../workers/AITypes'
import type { TrackedHandState } from '../input/HandTracker'

type Connection = [keyof PoseData, keyof PoseData]

const CONNECTIONS: Connection[] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
]

const LANDMARK_KEYS: (keyof PoseData)[] = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
]

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

export class DebugSkeleton {
  draw(
    renderer: Renderer,
    pose: PoseData,
    hands: HandData | null = null,
    trackedHands: readonly TrackedHandState[] = [],
  ): void {
    if (!pose.detected) {
      renderer.drawCenteredText('No pose detected', 20, '#ffaa00')
      if (!hands?.left && !hands?.right) return
    }

    const w = renderer.width
    const h = renderer.height

    if (pose.detected) {
      for (const [a, b] of CONNECTIONS) {
        const pa = pose[a] as Point
        const pb = pose[b] as Point
        renderer.drawLine(
          (1 - pa.x) * w, pa.y * h,
          (1 - pb.x) * w, pb.y * h,
          '#00ff88',
          2,
        )
      }

      for (const key of LANDMARK_KEYS) {
        const p = pose[key] as Point
        const vis = p.visibility ?? 0
        const radius = key === 'nose' ? 6 : 4
        const alpha = vis > 0.5 ? 1.0 : 0.4
        const color = vis > 0.5 ? '#00ffcc' : '#ffcc00'
        renderer.drawCircle((1 - p.x) * w, p.y * h, radius, color)
        renderer.drawText(key, (1 - p.x) * w + 8, p.y * h - 8, {
          size: 10,
          color: `rgba(255,255,255,${alpha})`,
          align: 'left',
          baseline: 'bottom',
        })
      }
    }

    const leftTracked = trackedHands.find((hand) => hand.handedness === 'left') ?? null
    const rightTracked = trackedHands.find((hand) => hand.handedness === 'right') ?? null
    this.drawHand(renderer, hands?.left ?? null, leftTracked, '#44aaff')
    this.drawHand(renderer, hands?.right ?? null, rightTracked, '#ff66aa')
  }

  private drawHand(
    renderer: Renderer,
    hand: SingleHand | null,
    tracked: TrackedHandState | null,
    color: string,
  ): void {
    if (!hand) return

    const w = renderer.width
    const h = renderer.height
    const projectedPalm = this.getPalmScreenPosition(hand, w, h)
    const offsetX = tracked?.present ? tracked.x - projectedPalm.x : 0
    const offsetY = tracked?.present ? tracked.y - projectedPalm.y : 0
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = hand.landmarks[a]
      const pb = hand.landmarks[b]
      renderer.drawLine(
        (1 - pa.x) * w + offsetX,
        pa.y * h + offsetY,
        (1 - pb.x) * w + offsetX,
        pb.y * h + offsetY,
        color,
        2,
      )
    }

    for (let i = 0; i < hand.landmarks.length; i++) {
      const point = hand.landmarks[i]
      const x = (1 - point.x) * w + offsetX
      const y = point.y * h + offsetY
      renderer.drawCircle(x, y, i === 0 ? 6 : 4, color)
    }

    const labelX = tracked?.x ?? ((1 - hand.landmarks[0].x) * w)
    const labelY = tracked?.y ?? (hand.landmarks[0].y * h)
    if (tracked?.present) {
      renderer.drawCircle(labelX, labelY, 8, undefined, color, 2)
    }
    renderer.drawText(
      `${hand.handedness} ${(hand.confidence * 100).toFixed(0)}%`,
      labelX + 12,
      labelY - 14,
      { size: 11, color, align: 'left', baseline: 'bottom' },
    )
  }

  private getPalmScreenPosition(hand: SingleHand, viewportWidth: number, viewportHeight: number): { x: number; y: number } {
    const palmIndices = [0, 5, 9, 17].filter((index) => index < hand.landmarks.length)
    let sumX = 0
    let sumY = 0

    for (const index of palmIndices) {
      sumX += (1 - hand.landmarks[index].x) * viewportWidth
      sumY += hand.landmarks[index].y * viewportHeight
    }

    const count = Math.max(palmIndices.length, 1)
    return {
      x: sumX / count,
      y: sumY / count,
    }
  }
}
