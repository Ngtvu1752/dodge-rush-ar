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
import { GameManager } from './game/GameManager'
import { GameState } from './game/GameState'
import { type UIContext } from './render/UIOverlay'
import { UIRoot } from './render/ui/UIRoot'
import { ObstacleVisualManager } from './render/entities/ObstacleVisualManager'
import { ParticleEmitter } from './render/vfx/ParticleEmitter'
import { ScreenShake } from './render/vfx/ScreenShake'
import { FeedbackPopup } from './render/vfx/FeedbackPopup'
import { BASE_POINTS_SUCCESS, MAX_HEALTH } from './config/gameConfig'
import type { ModelType } from './workers/AITypes'
import { DebugDepthMap } from './render/DebugDepthMap'

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
const game = new GameManager()
const debugDepthMap = new DebugDepthMap()

let debugMode = false
let lastTimestamp = 0
let loadingMessage = ''
let loadingError = ''

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

  loadingMessage = 'Loading AI models (first time may take a few seconds)...'

  aiWorkerManager.init().then((loaded) => {
    if (!loaded) {
      loadingError = `AI worker failed: ${aiWorkerManager.error}`
      console.error(loadingError)
      return
    }
    loadingMessage = ''
    poseTracker.attach(aiWorkerManager)
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
    modelEnabled.hands = !modelEnabled.hands
    aiWorkerManager.setModels({ hands: modelEnabled.hands })
    console.info(`[Scheduler] Hands: ${modelEnabled.hands ? 'ON' : 'OFF'}`)
  }
  if (e.key === '3') {
    modelEnabled.depth = !modelEnabled.depth
    aiWorkerManager.setModels({ depth: modelEnabled.depth })
    if (modelEnabled.depth) {
      sceneManager.enableOcclusion()
    } else {
      sceneManager.disableOcclusion()
    }
    console.info(`[Scheduler] Depth: ${modelEnabled.depth ? 'ON' : 'OFF'}`)
  }

  // F key: toggle depth map debug overlay
  if (e.key === 'f' || e.key === 'F') {
    debugDepthMap.toggle()
    console.info(`[Depth] Debug overlay: ${debugDepthMap.visible ? 'ON' : 'OFF'}`)
  }

  // Dev-only test controls (temporary, not real gameplay)
  if (state === GameState.Playing) {
    if (e.key === 's' || e.key === 'S') {
      game.score.registerSuccess(BASE_POINTS_SUCCESS)
      feedbackPopup.show('DODGED!', '#00ff88')
    }
    if (e.key === 't' || e.key === 'T') {
      game.score.registerFail()
      feedbackPopup.show('HIT!', '#ff4444')
    }
    if (e.key === 'm' || e.key === 'M') {
      game.score.registerMiss()
      feedbackPopup.show('MISS', '#ff8844')
    }
    if (e.key === 'o' || e.key === 'O') {
      game.debugSpawnBlueOrb()
    }
  }
})

function buildUIContext(): UIContext {
  const s = game.score
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
  }
}

function gameLoop(timestamp: number) {
  const dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0
  lastTimestamp = timestamp

  game.update(dt)

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

  // Draw depth map debug overlay (reads from worker results)
  const depthMap = aiWorkerManager.lastDepthMap
  if (depthMap) {
    debugDepthMap.draw(depthMap)
    sceneManager.updateDepthMap(depthMap)
  }

  if (debugMode) {
    debugSkeleton.draw(renderer, pose)
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
    const obstacles = game.getObstacles()

    // Sync Three.js visuals (creates/disposes adapters as needed)
    obstacleVisualManager.sync(obstacles, renderer.width, renderer.height)

    // Canvas2D fallback for obstacles without Three.js visuals
    for (const o of obstacles) {
      if (!obstacleVisualManager.hasVisual(o.id)) {
        o.render(renderer)
      }
    }

    const cal = calibration.data
    if (cal) {
      const action = gestureDetector.detect(pose, cal, timestamp)
      game.evaluateCollisions(action, pose, timestamp)

      // Show feedback based on obstacle results
      for (const o of game.getObstacles()) {
        if (o.resolved && o.result) {
          const screenX = o.x + o.width / 2
          const screenY = o.y + o.height / 2

          if (o.result === 'success') {
            if (o.type === 'BlueOrb') {
              feedbackPopup.show('TOUCHED!', '#00ff88', screenX, screenY)
              particleEmitter.burst(screenX, screenY, 'sparkle')
            } else if (o.type === 'HighLaser') {
              feedbackPopup.show('SQUAT OK', '#00ff88', screenX, screenY)
              particleEmitter.burst(screenX, screenY, 'success')
            } else {
              feedbackPopup.show('DODGED!', '#00ff88', screenX, screenY)
              particleEmitter.burst(screenX, screenY, 'success')
            }
          } else if (o.result === 'fail') {
            if (o.type === 'BlueOrb') {
              feedbackPopup.show('MISS', '#ff8844', screenX, screenY)
            } else {
              feedbackPopup.show('HIT!', '#ff4444', screenX, screenY)
              particleEmitter.burst(screenX, screenY, 'fail')
              screenShake.shake(8)
            }
          }
          o.result = null  // Clear after showing
        }
      }

      if (debugMode) {
        const hipX = (pose.leftHip.x + pose.rightHip.x) / 2
        const hipY = (pose.leftHip.y + pose.rightHip.y) / 2
        const offset = hipX - cal.neutralCenterX
        const drop = hipY - cal.standingHipY

        const lines = [
          `Difficulty: ${game.difficulty.level}`,
          `Speed: ${game.difficulty.speed}  Interval: ${game.difficulty.spawnInterval.toFixed(1)}s`,
          `offset=${offset.toFixed(3)}  drop=${drop.toFixed(3)}`,
          `dodgeL=${action.dodgeLeft}  dodgeR=${action.dodgeRight}`,
          `squat=${action.squat}`,
          `Lhand=${action.leftHandActive}  Rhand=${action.rightHandActive}`,
          `shield=${action.shield}`,
        ]
        lines.forEach((line, i) => {
          renderer.drawText(line, 10, 40 + i * 18, {
            size: 14,
            color: '#00ff88',
            align: 'left',
            baseline: 'top',
          })
        })

        // V2 Scheduler debug overlay
        const ss = aiWorkerManager.lastSchedulerStatus
        const schedulerLines = [
          `── AI Scheduler [1]pose:${modelEnabled.pose ? 'ON' : 'OFF'} [2]hands:${modelEnabled.hands ? 'ON' : 'OFF'} [3]depth:${modelEnabled.depth ? 'ON' : 'OFF'} ──`,
          `ran: ${ss?.modelsRan.join('+') ?? '—'}  skipped: ${ss?.modelsSkipped.join('+') ?? '—'}`,
          `pose: ${(ss?.inferenceMs.pose ?? 0).toFixed(1)}ms  hands: ${(ss?.inferenceMs.hands ?? 0).toFixed(1)}ms  depth: ${(ss?.inferenceMs.depth ?? 0).toFixed(1)}ms`,
          `total: ${(ss?.lastTotalMs ?? 0).toFixed(1)}ms  budget exceeded: ${ss?.budgetExceeded ?? false}`,
        ]
        const baseY = 40 + lines.length * 18 + 10
        schedulerLines.forEach((line, i) => {
          renderer.drawText(line, 10, baseY + i * 18, {
            size: 14,
            color: ss?.budgetExceeded ? '#ff8844' : '#00ccff',
            align: 'left',
            baseline: 'top',
          })
        })
      }
    }
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
