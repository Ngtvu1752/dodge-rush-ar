import type { PoseData, Point } from '../pose/PoseTypes'
import type { Renderer } from './Renderer'

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

export class DebugSkeleton {
  draw(renderer: Renderer, pose: PoseData): void {
    if (!pose.detected) {
      renderer.drawCenteredText('No pose detected', 20, '#ffaa00')
      return
    }

    const w = renderer.width
    const h = renderer.height

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
}
