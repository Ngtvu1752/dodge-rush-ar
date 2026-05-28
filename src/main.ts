import './style.css'
import { CameraManager } from './camera/CameraManager'
import { Renderer } from './render/Renderer'
import { EntityRenderer } from './render/EntityRenderer'
import { SceneManager } from './render/SceneManager'
import { PoseTracker } from './pose/PoseTracker'
import { AIWorkerManager } from './workers/AIWorkerManager'
import { PoseSmoother } from './pose/PoseSmoother'
import { DebugSkeleton } from './render/DebugSkeleton'
import { Calibration } from './input/Calibration'
import { GestureDetector } from './input/GestureDetector'
import { HandTracker } from './input/HandTracker'
import { GameManager } from './game/GameManager'
import { GameState } from './game/GameState'
import { type UIContext } from './render/UIOverlay'
import { UIRoot } from './render/ui/UIRoot'
import { ObstacleVisualManager } from './render/entities/ObstacleVisualManager'
import { ParticleEmitter } from './render/vfx/ParticleEmitter'
import { ScreenShake } from './render/vfx/ScreenShake'
import { FeedbackPopup } from './render/vfx/FeedbackPopup'
import { GrabIndicator } from './render/vfx/GrabIndicator'
import { BASE_POINTS_SUCCESS, MAX_HEALTH } from './config/gameConfig'
import type { ModelType, RuntimeProfile } from './workers/AITypes'
import { DebugDepthMap } from './render/DebugDepthMap'
import { ObstacleType } from './entities/Obstacle'
import type { BlueOrb } from './entities/BlueOrb'
import type { TrackedHandState } from './input/HandTracker'
import { detectRuntimeCapabilities } from './utils/FeatureDetection'
import { PerformanceMonitor } from './utils/PerformanceMonitor'
import { SFXManager } from './audio/SFXManager'

const obstacleToggleKeys = {
  '4': { type: ObstacleType.RedWallLeft, label: 'RedWallLeft' },
  '5': { type: ObstacleType.RedWallRight, label: 'RedWallRight' },
  '6': { type: ObstacleType.RedWallCenter, label: 'RedWallCenter' },
  '7': { type: ObstacleType.HighLaser, label: 'HighLaser' },
  '8': { type: ObstacleType.BlueOrb, label: 'BlueOrb' },
  '9': { type: ObstacleType.Meteor, label: 'Meteor' },
} as const

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const entityCanvas = document.querySelector<HTMLCanvasElement>('#entity-canvas')!
const renderer = new Renderer(canvas)
const entityRenderer = new EntityRenderer(entityCanvas)
const sceneManager = new SceneManager(entityRenderer.renderer)
const obstacleVisualManager = new ObstacleVisualManager(sceneManager.scene)
const particleEmitter = new ParticleEmitter(sceneManager.scene)
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root')!
const gameContainer = document.querySelector<HTMLDivElement>('#game-container')!
const screenShake = new ScreenShake(gameContainer)
const feedbackPopup = new FeedbackPopup(uiRoot)
const domUI = new UIRoot(uiRoot, MAX_HEALTH)
const camera = new CameraManager('webcam')
const aiWorkerManager = new AIWorkerManager()
const poseTracker = new PoseTracker()
const poseSmoother = new PoseSmoother()
const debugSkeleton = new DebugSkeleton()
const calibration = new Calibration()
const gestureDetector = new GestureDetector()
const handTracker = new HandTracker()
const game = new GameManager()
const debugDepthMap = new DebugDepthMap()
const grabIndicator = new GrabIndicator(sceneManager.scene)
const runtimeCapabilities = detectRuntimeCapabilities()
const performanceMonitor = new PerformanceMonitor()
const sfx = new SFXManager()

// Wire up SFX callbacks
game.score.onComboUp = () => sfx.play('comboUp')
game.score.onComboBreak = () => sfx.play('comboBreak')
game.difficulty.onDifficultyChange = () => sfx.play('difficultyUp')

let debugMode = false
let sfxMuted = false
let lastTimestamp = 0
let prevCountdown = ''
let prevState: GameState = GameState.Loading
let loadingMessage = ''
let loadingError = ''
let runtimeProfile: RuntimeProfile = runtimeCapabilities.recommendedProfile

const HAND_DEBUG_EVENT_TTL_MS = 240

type HandDebugPulse = {
  label: 'PINCH' | 'GRAB' | 'RELEASE' | '-'
  until: number
}

type ThrownOrbDebugPulse = {
  label: 'BULLSEYE' | 'MISS' | 'none'
  until: number
}

type ProjectileTargetDebugPulse = {
  label: 'RedWallLeft' | 'RedWallRight' | 'RedWallCenter' | 'Meteor' | 'none'
  until: number
}

const handDebugPulse: Record<'left' | 'right', HandDebugPulse> = {
  left: { label: '-', until: 0 },
  right: { label: '-', until: 0 },
}

const thrownOrbDebugPulse: ThrownOrbDebugPulse = {
  label: 'none',
  until: 0,
}

const projectileTargetDebugPulse: ProjectileTargetDebugPulse = {
  label: 'none',
  until: 0,
}

function clampFeedbackPosition(x: number, y: number): { x: number; y: number } {
  const marginX = 120
  const marginY = 90
  return {
    x: Math.max(marginX, Math.min(window.innerWidth - marginX, x)),
    y: Math.max(marginY, Math.min(window.innerHeight - marginY, y)),
  }
}

function getHandInstantEventLabel(hand: TrackedHandState): HandDebugPulse['label'] {
  if (hand.justReleased) {
    return 'RELEASE'
  }

  if (hand.justGrabbed) {
    return 'GRAB'
  }

  if (hand.justPinched) {
    return 'PINCH'
  }

  return '-'
}

function updateHandDebugPulse(hand: TrackedHandState, timestamp: number): void {
  const pulse = handDebugPulse[hand.handedness]
  const instantEvent = getHandInstantEventLabel(hand)

  if (instantEvent !== '-') {
    pulse.label = instantEvent
    pulse.until = timestamp + HAND_DEBUG_EVENT_TTL_MS
    return
  }

  if (pulse.until <= timestamp) {
    pulse.label = '-'
  }
}

function renderHandDebugEvents(baseY: number, timestamp: number): void {
  const hands = [handTracker.left, handTracker.right]

  hands.forEach((hand, index) => {
    const pulse = handDebugPulse[hand.handedness]
    const recentEvent = pulse.until > timestamp ? pulse.label : '-'
    const instantEvent = getHandInstantEventLabel(hand)
    const line = `${hand.handedness.toUpperCase()} recent=${recentEvent} now=${instantEvent} present=${hand.present}`
    renderer.drawText(line, 10, baseY + index * 18, {
      size: 14,
      color: recentEvent !== '-' ? '#ffd166' : '#88aacc',
      align: 'left',
      baseline: 'top',
    })
  })
}

function updateThrownOrbDebugPulse(label: 'BULLSEYE' | 'MISS', timestamp: number): void {
  thrownOrbDebugPulse.label = label
  thrownOrbDebugPulse.until = timestamp + 700
}

function getThrownOrbDebugLabel(timestamp: number): ThrownOrbDebugPulse['label'] {
  if (thrownOrbDebugPulse.until > timestamp) {
    return thrownOrbDebugPulse.label
  }

  return 'none'
}

function getRuntimeStatusLabel(): string {
  const occlusion = runtimeCapabilities.occlusionSupported ? 'OCCLUSION' : 'NO-OCCLUSION'
  const suffix = runtimeCapabilities.fallbackReason !== 'none'
    ? `  ${runtimeCapabilities.fallbackReason}`
    : ''
  const sfxStatus = sfxMuted ? '  SFX:MUTED' : ''
  return `Runtime: ${runtimeProfile.toUpperCase()}  ${occlusion}${suffix}${sfxStatus}`
}

function getCapabilityStatusLabel(): string {
  return `${runtimeCapabilities.capabilityLabel} | profile=${runtimeProfile}`
}

function applyRuntimeProfile(): void {
  aiWorkerManager.setRuntimeProfile(runtimeProfile)
  sceneManager.setRuntimeProfile(runtimeProfile, runtimeCapabilities)

  if (runtimeProfile === 'fallback' && modelEnabled.depth) {
    modelEnabled.depth = false
    aiWorkerManager.setModels({ depth: false })
    sceneManager.disableOcclusion()
    console.info('[Runtime] Fallback profile disabled depth for stability.')
  }
}

function cycleRuntimeProfile(): void {
  runtimeProfile = runtimeProfile === 'balanced' ? 'fallback' : 'balanced'
  applyRuntimeProfile()
  console.info(`[Runtime] Profile: ${runtimeProfile.toUpperCase()}`)
}

function updateProjectileTargetDebugPulse(label: ProjectileTargetDebugPulse['label'], timestamp: number): void {
  projectileTargetDebugPulse.label = label
  projectileTargetDebugPulse.until = timestamp + 900
}

function getProjectileTargetDebugLabel(timestamp: number): ProjectileTargetDebugPulse['label'] {
  if (projectileTargetDebugPulse.until > timestamp) {
    return projectileTargetDebugPulse.label
  }

  return 'none'
}

// V2 model toggle state
const modelEnabled: Record<ModelType, boolean> = {
  pose: true,
  hands: false,
  depth: false,
}

game.setCameraPermission()

camera.init().then((ok) => {
  if (!ok) {
    loadingError = camera.errorMessage
    return
  }
  sceneManager.setBackgroundVideo(camera.getVideo())
  sceneManager.setRuntimeProfile(runtimeProfile, runtimeCapabilities)

  loadingMessage = `Loading AI models (first time may take a few seconds)...\n${getCapabilityStatusLabel()}`

  aiWorkerManager.init().then((loaded) => {
    if (!loaded) {
      loadingError = `AI worker failed: ${aiWorkerManager.error}`
      console.error(loadingError)
      return
    }
    loadingMessage = getCapabilityStatusLabel()
    poseTracker.attach(aiWorkerManager)
    applyRuntimeProfile()
    game.startCalibration()
  }).catch((err) => {
    loadingError = `AI worker crashed: ${err instanceof Error ? err.message : String(err)}`
    console.error(loadingError)
  })
})

window.addEventListener('keydown', (e) => {
  const state = game.getState()

  if (e.key === 'd' || e.key === 'D') {
    debugMode = !debugMode
    document.body.classList.toggle('debug-active', debugMode)
  }

  if (e.key === 'c' || e.key === 'C') {
    if (state === GameState.Calibration && calibration.status === 'idle') {
      calibration.start()
    } else {
      calibration.reset()
      game.recalibrate()
    }
  }

  if (e.key === ' ') {
    if (state === GameState.Ready) {
      game.startCountdown()
    } else if (state === GameState.Playing) {
      game.endGame()
    } else if (state === GameState.GameOver) {
      game.showResult()
    } else if (state === GameState.Result) {
      game.restart()
    }
  }

  // V2 model toggles (keys 1/2/3)
  if (e.key === '1') {
    modelEnabled.pose = !modelEnabled.pose
    aiWorkerManager.setModels({ pose: modelEnabled.pose })
    console.info(`[Scheduler] Pose: ${modelEnabled.pose ? 'ON' : 'OFF'}`)
  }
  if (e.key === '2') {
    if (!runtimeCapabilities.handsSupported) {
      console.info('[Runtime] Hands unsupported on this browser/runtime.')
      return
    }
    modelEnabled.hands = !modelEnabled.hands
    aiWorkerManager.setModels({ hands: modelEnabled.hands })
    console.info(`[Scheduler] Hands: ${modelEnabled.hands ? 'ON' : 'OFF'}`)
  }
  if (e.key === '3') {
    if (!runtimeCapabilities.depthSupported || !runtimeCapabilities.occlusionSupported) {
      console.info('[Runtime] Depth/Occlusion unsupported on this browser/runtime.')
      return
    }
    modelEnabled.depth = !modelEnabled.depth
    aiWorkerManager.setModels({ depth: modelEnabled.depth })
    if (modelEnabled.depth) {
      sceneManager.enableOcclusion()
    } else {
      sceneManager.disableOcclusion()
    }
    console.info(`[Scheduler] Depth: ${modelEnabled.depth ? 'ON' : 'OFF'}`)
  }

  if (e.key === 'p' || e.key === 'P') {
    cycleRuntimeProfile()
  }
  if (e.key in obstacleToggleKeys) {
    const toggle = obstacleToggleKeys[e.key as keyof typeof obstacleToggleKeys]
    const enabled = game.toggleSpawnType(toggle.type)
    console.info(`[Spawn Toggle] ${toggle.label}: ${enabled ? 'ON' : 'OFF'}`)
  }

  // F key: toggle depth map debug overlay
  if (e.key === 'f' || e.key === 'F') {
    debugDepthMap.toggle()
    console.info(`[Depth] Debug overlay: ${debugDepthMap.visible ? 'ON' : 'OFF'}`)
  }

  // M key: toggle SFX mute
  if (e.key === 'm' || e.key === 'M') {
    sfxMuted = !sfxMuted
    sfx.setMuted(sfxMuted)
    console.info(`[SFX] ${sfxMuted ? 'MUTED' : 'UNMUTED'}`)
  }

  // Dev-only test controls (temporary, not real gameplay)
    if (state === GameState.Playing) {
      if (e.key === 's' || e.key === 'S') {
        game.score.registerSuccess(BASE_POINTS_SUCCESS)
        feedbackPopup.show('DODGED!', '#00ff88', undefined, undefined, { fontSizeRem: 2.1, travelY: -90 })
      }
      if (e.key === 't' || e.key === 'T') {
        game.score.registerFail()
        feedbackPopup.show('HIT!', '#ff4444', undefined, undefined, { fontSizeRem: 2.2, travelY: -75, glowColor: '#ff8a8a' })
      }
    if (e.key === 'o' || e.key === 'O') {
      if (!game.debugSpawnBlueOrb()) {
        console.info('[Spawn Toggle] BlueOrb is OFF, debug spawn skipped.')
      }
    }
  }
})

function buildUIContext(): UIContext {
  const s = game.score
  const hands = handTracker.states
  const activeGrab = game.getObstacles().find((o) => o.type === ObstacleType.BlueOrb && (o as BlueOrb).interactionState === 'grabbed') as BlueOrb | undefined
  return {
    state: game.getState(),
    score: s.score,
    combo: s.combo,
    bestCombo: s.bestCombo,
    multiplier: s.multiplier,
    health: s.health,
    maxHealth: MAX_HEALTH,
    remaining: s.remaining,
    successes: s.successes,
    fails: s.fails,
    misses: s.misses,
    difficulty: game.difficulty.level,
    countdown: game.getCountdownNumber(),
    calibrationStatus: calibration.status,
    calibrationProgress: calibration.progress,
    cameraError: camera.errorMessage ?? '',
    loadingMessage: loadingError || loadingMessage,
    debug: debugMode,
    handTrackingStatus: hands.some((hand) => hand.present) ? 'TRACKING' : 'SEARCHING',
    pinchStatus: `L:${handTracker.left.phase} R:${handTracker.right.phase}`,
    grabStatus: activeGrab ? `Grabbed by ${activeGrab.grabbedBy}` : 'No grab',
    throwReady: handTracker.left.canThrow || handTracker.right.canThrow,
    runtimeStatus: getRuntimeStatusLabel(),
  }
}

function gameLoop(timestamp: number) {
  const dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0
  lastTimestamp = timestamp

  game.update(dt)

  // Countdown SFX
  const currentCountdown = game.getCountdownNumber()
  if (currentCountdown !== prevCountdown) {
    if (currentCountdown === 'GO!') {
      sfx.play('countdownGo')
    } else if (currentCountdown === '3' || currentCountdown === '2' || currentCountdown === '1') {
      sfx.play('countdown')
    }
    prevCountdown = currentCountdown
  }

  // Game over SFX
  const currentState = game.getState()
  if (currentState === GameState.GameOver && prevState !== GameState.GameOver) {
    sfx.play('gameOver')
  }
  prevState = currentState

  renderer.clear(!debugMode)

  if (!camera.isReady) {
    domUI.update(buildUIContext())
    requestAnimationFrame(gameLoop)
    return
  }

  // Send video frame to AI worker (non-blocking, worker runs inference async)
  poseTracker.requestDetect(camera.getVideo(), timestamp)
  // Read the latest completed inference result
  const raw = poseTracker.readLatest(timestamp)
  const pose = poseSmoother.smooth(raw)
  const hands = aiWorkerManager.lastHands
  handTracker.update(hands, timestamp, renderer.width, renderer.height)
  updateHandDebugPulse(handTracker.left, timestamp)
  updateHandDebugPulse(handTracker.right, timestamp)

  // Draw depth map debug overlay (reads from worker results)
  const depthMap = aiWorkerManager.lastDepthMap
  if (depthMap) {
    debugDepthMap.draw(depthMap)
    sceneManager.updateDepthMap(depthMap)
  }

  performanceMonitor.update(timestamp, aiWorkerManager.lastSchedulerStatus, runtimeProfile)

  if (debugMode) {
    debugSkeleton.draw(renderer, pose, hands, handTracker.states)
    renderHandDebugEvents(40, timestamp)
  }

  const state = game.getState()

  // Calibration state needs special handling for pose feeding
  if (state === GameState.Calibration && calibration.status === 'collecting') {
    if (calibration.feed(pose)) {
      game.completeCalibration()
    }
  }

  // Playing state: render obstacles and evaluate collisions
  if (state === GameState.Playing) {
    const cal = calibration.data
    if (cal) {
      const action = gestureDetector.detect(pose, cal, timestamp)
      const prevThrownCount = game.getThrownOrbs().length
      game.updateHandInteractions(handTracker, renderer.width, renderer.height)
      game.evaluateCollisions(action, pose, timestamp)

      // Hand interaction SFX
      if (handTracker.left.justGrabbed || handTracker.right.justGrabbed) {
        sfx.play('grab')
      }
      if (game.getThrownOrbs().length > prevThrownCount) {
        sfx.play('throw')
      }

      const obstacles = [...game.getObstacles(), ...game.getThrownOrbs()]
      obstacleVisualManager.sync(obstacles, renderer.width, renderer.height)

      for (const o of obstacles) {
        if (!obstacleVisualManager.hasVisual(o.id)) {
          o.render(renderer)
        }
      }

      const candidateOrb = game.getObstacles().find(
        (o) => o.type === ObstacleType.BlueOrb && (o as BlueOrb).interactionState === 'candidate',
      ) as BlueOrb | undefined
      grabIndicator.sync(candidateOrb ?? null, dt)

      // Show feedback based on obstacle results
      for (const o of [...game.getObstacles(), ...game.getThrownOrbs()]) {
        if (o.resolved && o.result) {
          const rawX = o.x + o.width / 2
          const rawY = o.y + o.height / 2
          const { x: screenX, y: screenY } = clampFeedbackPosition(rawX, rawY)

            if (o.result === 'success') {
              if (o.type === 'BlueOrb') {
                sfx.play('orbTouch')
                feedbackPopup.show('TOUCHED!', '#3ff5a6', screenX, screenY, {
                  fontSizeRem: 1.85,
                  travelY: -78,
                  glowColor: '#bffff0',
                })
                particleEmitter.burst(screenX, screenY, 'sparkle')
              } else if (o.type === ObstacleType.ThrownOrb) {
                sfx.play('bullseye')
                feedbackPopup.show('BULLSEYE!', '#7fd6ff', screenX, screenY, {
                  fontSizeRem: 2.3,
                  travelY: -118,
                  glowColor: '#d6f3ff',
                  letterSpacingPx: 1.8,
                })
                particleEmitter.burst(screenX, screenY, 'projectileHit')
                updateThrownOrbDebugPulse('BULLSEYE', timestamp)
              } else if (o.type === 'HighLaser') {
                sfx.play('squat')
                feedbackPopup.show('SQUAT OK', '#00ff88', screenX, screenY, {
                  fontSizeRem: 1.8,
                  travelY: -82,
                })
                particleEmitter.burst(screenX, screenY, 'success')
              } else if (o.resultCause === 'projectile') {
                sfx.play(o.type === 'Meteor' ? 'meteorDown' : 'wallBreak')
                const hitLabel = o.type === 'Meteor' ? 'METEOR DOWN' : 'WALL BREAK'
                const popupColor = o.type === 'Meteor' ? '#ffbf7a' : '#ff8d9c'
                feedbackPopup.show(hitLabel, popupColor, screenX, screenY, {
                  fontSizeRem: o.type === 'Meteor' ? 2.1 : 2.25,
                  travelY: -108,
                  glowColor: o.type === 'Meteor' ? '#ffe2bf' : '#ffd3da',
                  letterSpacingPx: 1.6,
                })
                particleEmitter.burst(screenX, screenY, o.type === 'Meteor' ? 'projectileHit' : 'wallBreak')
                if (o.type === ObstacleType.RedWallLeft || o.type === ObstacleType.RedWallRight || o.type === ObstacleType.RedWallCenter || o.type === ObstacleType.Meteor) {
                  updateProjectileTargetDebugPulse(o.type, timestamp)
                }
              } else {
                sfx.play('dodge')
                feedbackPopup.show('DODGED!', '#00ff88', screenX, screenY, {
                  fontSizeRem: 1.95,
                  travelY: -86,
                })
                particleEmitter.burst(screenX, screenY, 'success')
              }
            } else if (o.result === 'fail') {
              if (o.type === 'BlueOrb') {
                sfx.play('orbMiss')
                feedbackPopup.show('MISS', '#ff8844', screenX, screenY, {
                  fontSizeRem: 1.65,
                  travelY: -68,
                })
              } else if (o.type === ObstacleType.ThrownOrb) {
                sfx.play('orbMiss')
                feedbackPopup.show('THROW MISS', '#8dbfe6', screenX, screenY, {
                  fontSizeRem: 1.75,
                  travelY: -72,
                  glowColor: '#d4ecff',
                })
                updateThrownOrbDebugPulse('MISS', timestamp)
              } else {
                sfx.play('hit')
                feedbackPopup.show('HIT!', '#ff4444', screenX, screenY, {
                  fontSizeRem: 2.15,
                  travelY: -72,
                  glowColor: '#ffb1b1',
                })
                particleEmitter.burst(screenX, screenY, 'fail')
                screenShake.shake(8)
              }
            }
          o.result = null  // Clear after showing
          o.resultCause = undefined
        }
      }

      if (debugMode) {
        const hipX = (pose.leftHip.x + pose.rightHip.x) / 2
        const hipY = (pose.leftHip.y + pose.rightHip.y) / 2
        const offset = hipX - cal.neutralCenterX
        const drop = hipY - cal.standingHipY
        const leftHand = handTracker.left
        const rightHand = handTracker.right
        const activeGrab = game.getObstacles().find(
          (o) => o.type === ObstacleType.BlueOrb && (o as BlueOrb).interactionState === 'grabbed',
        ) as BlueOrb | undefined
        const thrownOrbs = game.getThrownOrbs()
        const blueOrbTouchPolicy = game.getBlueOrbTouchPolicy()
        const spawnEnabled = game.getSpawnEnabled()
        const performanceSnapshot = performanceMonitor.getSnapshot()
        const schedulerStatus = aiWorkerManager.lastSchedulerStatus

        const lines = [
          `runtime=${runtimeProfile} fallback=${runtimeCapabilities.fallbackReason} fps=${performanceSnapshot.fps.toFixed(1)} frame=${performanceSnapshot.frameMs.toFixed(1)}ms`,
          `caps hands=${runtimeCapabilities.handsSupported} depth=${runtimeCapabilities.depthSupported} occ=${runtimeCapabilities.occlusionSupported}`,
          `Difficulty: ${game.difficulty.level}`,
          `Speed: ${game.difficulty.speed}  Interval: ${game.difficulty.spawnInterval.toFixed(1)}s`,
          `offset=${offset.toFixed(3)}  drop=${drop.toFixed(3)}`,
          `dodgeL=${action.dodgeLeft}  dodgeR=${action.dodgeRight}`,
          `squat=${action.squat}`,
          `L:${leftHand.phase} conf=${leftHand.confidence.toFixed(2)} pinch=${leftHand.pinchDistance.toFixed(3)} speed=${leftHand.speed.toFixed(0)} throw=${leftHand.canThrow}`,
          `R:${rightHand.phase} conf=${rightHand.confidence.toFixed(2)} pinch=${rightHand.pinchDistance.toFixed(3)} speed=${rightHand.speed.toFixed(0)} throw=${rightHand.canThrow}`,
          `grab=${activeGrab ? activeGrab.grabbedBy : 'none'} ready=${leftHand.canThrow || rightHand.canThrow}`,
          `orbTouch=${blueOrbTouchPolicy.allowTouch ? 'fallback' : 'grab-first'} suppressedOrbs=${blueOrbTouchPolicy.suppressTouchForOrbIds.size}`,
          `thrown=${thrownOrbs.length} lastThrow=${getThrownOrbDebugLabel(timestamp)} lastHitTarget=${getProjectileTargetDebugLabel(timestamp)}`,
          `spawn [4]L=${spawnEnabled.RedWallLeft ? 'ON' : 'OFF'} [5]R=${spawnEnabled.RedWallRight ? 'ON' : 'OFF'} [6]C=${spawnEnabled.RedWallCenter ? 'ON' : 'OFF'}`,
          `spawn [7]Laser=${spawnEnabled.HighLaser ? 'ON' : 'OFF'} [8]Orb=${spawnEnabled.BlueOrb ? 'ON' : 'OFF'} [9]Meteor=${spawnEnabled.Meteor ? 'ON' : 'OFF'}`,
        ]
        lines.forEach((line, i) => {
          renderer.drawText(line, 10, 86 + i * 18, {
            size: 14,
            color: '#00ff88',
            align: 'left',
            baseline: 'top',
          })
        })

        // V2 Scheduler debug overlay
        const schedulerLines = [
          `AI Scheduler [1]pose=${modelEnabled.pose ? 'ON' : 'OFF'} [2]hands=${modelEnabled.hands ? 'ON' : 'OFF'} [3]depth=${modelEnabled.depth ? 'ON' : 'OFF'} [P]profile=${runtimeProfile}`,
          `ran: ${schedulerStatus?.modelsRan.join('+') ?? '-'}  skipped: ${schedulerStatus?.modelsSkipped.join('+') ?? '-'}`,
          `pose: ${(schedulerStatus?.inferenceMs.pose ?? 0).toFixed(1)}ms  hands: ${(schedulerStatus?.inferenceMs.hands ?? 0).toFixed(1)}ms  depth: ${(schedulerStatus?.inferenceMs.depth ?? 0).toFixed(1)}ms`,
          `total: ${(schedulerStatus?.lastTotalMs ?? 0).toFixed(1)}ms  budget exceeded: ${schedulerStatus?.budgetExceeded ?? false}`,
          `intervals pose=${schedulerStatus?.effectiveIntervalsMs.pose ?? 0} hands=${schedulerStatus?.effectiveIntervalsMs.hands ?? 0} depth=${schedulerStatus?.effectiveIntervalsMs.depth ?? 0}`,
        ]
        const baseY = 86 + lines.length * 18 + 10
        schedulerLines.forEach((line, i) => {
          renderer.drawText(line, 10, baseY + i * 18, {
            size: 14,
            color: schedulerStatus?.budgetExceeded ? '#ff8844' : '#00ccff',
            align: 'left',
            baseline: 'top',
          })
        })
      }
    } else {
      const obstacles = [...game.getObstacles(), ...game.getThrownOrbs()]
      obstacleVisualManager.sync(obstacles, renderer.width, renderer.height)
      for (const o of obstacles) {
        if (!obstacleVisualManager.hasVisual(o.id)) {
          o.render(renderer)
        }
      }
      grabIndicator.sync(null, dt)
    }
  }
  if (state !== GameState.Playing) {
    grabIndicator.sync(null, dt)
  }

  // Update VFX systems
  particleEmitter.update(dt)
  screenShake.apply()

  // Render Three.js entities (obstacles, particles) over webcam with bloom
  sceneManager.render()

  // Render DOM UI overlay on top of everything
  domUI.update(buildUIContext())

  requestAnimationFrame(gameLoop)
}

requestAnimationFrame(gameLoop)
