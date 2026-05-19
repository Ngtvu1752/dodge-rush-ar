import './style.css'
import { CameraManager } from './camera/CameraManager'
import { Renderer } from './render/Renderer'
import { EntityRenderer } from './render/EntityRenderer'
import { SceneManager } from './render/SceneManager'
import { PoseTracker } from './pose/PoseTracker'
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
const poseTracker = new PoseTracker()
const poseSmoother = new PoseSmoother()
const debugSkeleton = new DebugSkeleton()
const calibration = new Calibration()
const gestureDetector = new GestureDetector()
const game = new GameManager()

let debugMode = false
let lastTimestamp = 0

game.setCameraPermission()

camera.init().then((ok) => {
  if (!ok) {
    console.error(camera.errorMessage)
    return
  }
  sceneManager.setBackgroundVideo(camera.getVideo())
  poseTracker.init().then((loaded) => {
    if (!loaded) {
      console.error(poseTracker.error)
      return
    }
    game.startCalibration()
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

  // Dev-only test controls (temporary, not real gameplay)
  if (state === GameState.Playing) {
    if (e.key === 's' || e.key === 'S') {
      game.score.registerSuccess(BASE_POINTS_SUCCESS)
      feedbackPopup.show('DODGED!', '#00ff88')
    }
    if (e.key === 'f' || e.key === 'F') {
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

  const raw = poseTracker.detect(camera.getVideo(), timestamp)
  const pose = poseSmoother.smooth(raw)

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
