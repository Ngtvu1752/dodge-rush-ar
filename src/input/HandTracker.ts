import {
  HAND_GRAB_COOLDOWN_MS,
  HAND_GRAB_HOLD_MS,
  HAND_PINCH_ENTER_THRESHOLD,
  HAND_PINCH_EXIT_THRESHOLD,
  HAND_PREDICTION_LEAD_MS,
  HAND_PREDICTION_MAX_DISTANCE_PX,
  HAND_PREDICTION_MIN_CONFIDENCE,
  HAND_THROW_SPEED_THRESHOLD,
  HAND_SMOOTHING_GRABBED,
  HAND_SMOOTHING_OPEN,
  HAND_SMOOTHING_PINCHING,
  HAND_TRACKING_GRACE_MS,
  HAND_VELOCITY_HISTORY_SIZE,
} from '../config/gameConfig'
import type { HandData, SingleHand } from '../workers/AITypes'

export type HandPhase = 'missing' | 'open' | 'pinching' | 'grabbed'
export type Handedness = 'left' | 'right'

type VelocitySample = {
  x: number
  y: number
  time: number
}

export interface TrackedHandState {
  handedness: Handedness
  present: boolean
  phase: HandPhase
  confidence: number
  rawX: number
  rawY: number
  x: number
  y: number
  pinchDistance: number
  pinchStrength: number
  vx: number
  vy: number
  speed: number
  justPinched: boolean
  justGrabbed: boolean
  justReleased: boolean
  canThrow: boolean
  cooldownUntil: number
}

interface InternalHandState extends TrackedHandState {
  pinchStart: number
  lastSeenAt: number
  history: VelocitySample[]
}

function createState(handedness: Handedness): InternalHandState {
  return {
    handedness,
    present: false,
    phase: 'missing',
    confidence: 0,
    rawX: 0,
    rawY: 0,
    x: 0,
    y: 0,
    pinchDistance: 1,
    pinchStrength: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    justPinched: false,
    justGrabbed: false,
    justReleased: false,
    canThrow: false,
    cooldownUntil: 0,
    pinchStart: 0,
    lastSeenAt: 0,
    history: [],
  }
}

export class HandTracker {
  private leftState = createState('left')
  private rightState = createState('right')

  update(hands: HandData | null, timestamp: number, viewportWidth: number, viewportHeight: number): void {
    this.updateHand(this.leftState, hands?.left ?? null, timestamp, viewportWidth, viewportHeight)
    this.updateHand(this.rightState, hands?.right ?? null, timestamp, viewportWidth, viewportHeight)
  }

  get left(): TrackedHandState {
    return this.leftState
  }

  get right(): TrackedHandState {
    return this.rightState
  }

  get states(): readonly TrackedHandState[] {
    return [this.leftState, this.rightState]
  }

  beginGrab(handedness: Handedness): void {
    const state = handedness === 'left' ? this.leftState : this.rightState
    state.phase = 'grabbed'
    state.justGrabbed = true
  }

  forceRelease(handedness: Handedness, timestamp: number): void {
    const state = handedness === 'left' ? this.leftState : this.rightState
    state.phase = state.present ? 'open' : 'missing'
    state.justReleased = true
    state.cooldownUntil = timestamp + HAND_GRAB_COOLDOWN_MS
    state.pinchStart = 0
  }

  private updateHand(
    state: InternalHandState,
    hand: SingleHand | null,
    timestamp: number,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    const wasMissing = state.phase === 'missing'
    state.justPinched = false
    state.justGrabbed = false
    state.justReleased = false

    if (!hand || hand.landmarks.length < 9 || hand.confidence < 0.2) {
      const withinGrace = timestamp - state.lastSeenAt <= HAND_TRACKING_GRACE_MS
      state.present = withinGrace && state.phase === 'grabbed'
      if (!withinGrace && state.phase !== 'missing') {
        if (state.phase === 'grabbed') {
          state.justReleased = true
          state.cooldownUntil = timestamp + HAND_GRAB_COOLDOWN_MS
        }
        state.phase = 'missing'
        state.pinchStart = 0
      }
      state.confidence = 0
      state.vx = 0
      state.vy = 0
      state.speed = 0
      state.canThrow = false
      return
    }

    state.present = true
    state.lastSeenAt = timestamp
    state.confidence = hand.confidence

    const palm = this.getPalmCenter(hand)
    state.rawX = (1 - palm.x) * viewportWidth
    state.rawY = palm.y * viewportHeight

    state.history.push({ x: state.rawX, y: state.rawY, time: timestamp })
    while (state.history.length > HAND_VELOCITY_HISTORY_SIZE) {
      state.history.shift()
    }

    if (state.history.length >= 2) {
      const first = state.history[0]
      const last = state.history[state.history.length - 1]
      const dt = Math.max(last.time - first.time, 1)
      state.vx = ((last.x - first.x) / dt) * 1000
      state.vy = ((last.y - first.y) / dt) * 1000
      state.speed = Math.hypot(state.vx, state.vy)
    } else {
      state.vx = 0
      state.vy = 0
      state.speed = 0
    }

    const thumb = hand.landmarks[4]
    const index = hand.landmarks[8]
    const pinchDistance = Math.hypot(thumb.x - index.x, thumb.y - index.y)
    state.pinchDistance = pinchDistance
    state.pinchStrength = Math.max(0, 1 - pinchDistance / HAND_PINCH_EXIT_THRESHOLD)

    const belowEnter = pinchDistance <= HAND_PINCH_ENTER_THRESHOLD
    const aboveExit = pinchDistance >= HAND_PINCH_EXIT_THRESHOLD

    if (state.phase === 'missing') {
      state.phase = 'open'
    }

    if (timestamp < state.cooldownUntil) {
      if (aboveExit) {
        state.phase = 'open'
      }
      this.updateInteractionAnchor(state, viewportWidth, viewportHeight, wasMissing)
      state.canThrow = false
      return
    }

    if (state.phase === 'open') {
      if (belowEnter) {
        state.phase = 'pinching'
        state.pinchStart = timestamp
        state.justPinched = true
      }
    } else if (state.phase === 'pinching') {
      if (aboveExit) {
        state.phase = 'open'
        state.pinchStart = 0
      } else if (timestamp - state.pinchStart >= HAND_GRAB_HOLD_MS) {
        state.phase = 'grabbed'
        state.justGrabbed = true
      }
    } else if (state.phase === 'grabbed' && aboveExit) {
      state.phase = 'open'
      state.justReleased = true
      state.cooldownUntil = timestamp + HAND_GRAB_COOLDOWN_MS
      state.pinchStart = 0
    }

    this.updateInteractionAnchor(state, viewportWidth, viewportHeight, wasMissing)
    state.canThrow = state.phase === 'grabbed' && state.speed >= HAND_THROW_SPEED_THRESHOLD
  }

  private getPalmCenter(hand: SingleHand): { x: number; y: number } {
    const palmIndices = [0, 5, 9, 17].filter((index) => index < hand.landmarks.length)
    let sumX = 0
    let sumY = 0

    for (const index of palmIndices) {
      sumX += hand.landmarks[index].x
      sumY += hand.landmarks[index].y
    }

    const count = Math.max(palmIndices.length, 1)
    return {
      x: sumX / count,
      y: sumY / count,
    }
  }

  private updateInteractionAnchor(
    state: InternalHandState,
    viewportWidth: number,
    viewportHeight: number,
    snapToTarget: boolean,
  ): void {
    let targetX = state.rawX
    let targetY = state.rawY

    if (state.confidence >= HAND_PREDICTION_MIN_CONFIDENCE) {
      const leadSeconds = HAND_PREDICTION_LEAD_MS / 1000
      let leadX = state.vx * leadSeconds
      let leadY = state.vy * leadSeconds
      const leadDistance = Math.hypot(leadX, leadY)

      if (leadDistance > HAND_PREDICTION_MAX_DISTANCE_PX && leadDistance > 0) {
        const scale = HAND_PREDICTION_MAX_DISTANCE_PX / leadDistance
        leadX *= scale
        leadY *= scale
      }

      targetX += leadX
      targetY += leadY
    }

    targetX = Math.max(0, Math.min(viewportWidth, targetX))
    targetY = Math.max(0, Math.min(viewportHeight, targetY))

    if (snapToTarget || (state.x === 0 && state.y === 0)) {
      state.x = targetX
      state.y = targetY
      return
    }

    const factor = this.getSmoothingFactor(state.phase)
    state.x += (targetX - state.x) * factor
    state.y += (targetY - state.y) * factor
  }

  private getSmoothingFactor(phase: HandPhase): number {
    if (phase === 'grabbed') {
      return HAND_SMOOTHING_GRABBED
    }

    if (phase === 'pinching') {
      return HAND_SMOOTHING_PINCHING
    }

    return HAND_SMOOTHING_OPEN
  }
}
