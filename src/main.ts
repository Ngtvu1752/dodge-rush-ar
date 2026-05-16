import './style.css'
import { CameraManager } from './camera/CameraManager'
import { Renderer } from './render/Renderer'
import { PoseTracker } from './pose/PoseTracker'
import { PoseSmoother } from './pose/PoseSmoother'
import { DebugSkeleton } from './render/DebugSkeleton'
import { Calibration } from './input/Calibration'
import { GestureDetector } from './input/GestureDetector'
import { GameManager } from './game/GameManager'
import { GameState } from './game/GameState'
import { BASE_POINTS_SUCCESS } from './config/gameConfig'

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const renderer = new Renderer(canvas)
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
    }
    if (e.key === 'f' || e.key === 'F') {
      game.score.registerFail()
    }
    if (e.key === 'm' || e.key === 'M') {
      game.score.registerMiss()
    }
    if (e.key === 'o' || e.key === 'O') {
      game.debugSpawnBlueOrb()
    }
  }
})

function drawStats(): void {
  const s = game.score
  const lines = [
    `Score: ${s.score}`,
    `Combo: ${s.combo}  x${s.multiplier.toFixed(1)}`,
    `HP: ${'♥'.repeat(Math.max(s.health, 0))}`,
    `Time: ${Math.ceil(s.remaining)}s`,
    `Level: ${game.difficulty.level}`,
  ]
  lines.forEach((line, i) => {
    renderer.drawText(line, renderer.width - 10, 10 + i * 22, {
      size: 18,
      color: '#ffffff',
      align: 'right',
      baseline: 'top',
    })
  })
}

function drawResult(): void {
  const s = game.score
  const cx = renderer.width / 2
  const lines = [
    { text: 'Result', y: -80, size: 48, color: '#ffffff' },
    { text: `Score: ${s.score}`, y: -20, size: 28, color: '#00ff88' },
    { text: `Best Combo: ${s.bestCombo}`, y: 15, size: 22, color: '#ffffff' },
    { text: `Successes: ${s.successes}`, y: 50, size: 18, color: '#88ff88' },
    { text: `Fails: ${s.fails}`, y: 75, size: 18, color: '#ff8888' },
    { text: `Misses: ${s.misses}`, y: 100, size: 18, color: '#ffaa88' },
    { text: 'Press SPACE to restart', y: 145, size: 22, color: '#ffffff' },
  ]
  lines.forEach(({ text, y, size, color }) => {
    renderer.drawText(text, cx, renderer.height / 2 + y, { size, color })
  })
}

function gameLoop(timestamp: number) {
  const dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0
  lastTimestamp = timestamp

  game.update(dt)

  renderer.clear()

  if (!camera.isReady) {
    const state = game.getState()
    if (camera.status === 'error') {
      renderer.drawMultilineCentered(camera.errorMessage, 20, '#ff4444')
    } else if (state === GameState.CameraPermission) {
      renderer.drawCenteredText('Requesting camera access...', 24)
    } else {
      renderer.drawCenteredText('Dodge Rush AR — Initializing...', 24)
    }
    requestAnimationFrame(gameLoop)
    return
  }

  renderer.drawVideo(camera.getVideo())

  const raw = poseTracker.detect(camera.getVideo(), timestamp)
  const pose = poseSmoother.smooth(raw)

  if (debugMode) {
    debugSkeleton.draw(renderer, pose)
  }

  const state = game.getState()

  if (state === GameState.Calibration) {
    if (calibration.status === 'idle') {
      renderer.drawCenteredText('Press C to calibrate', 28)
    } else if (calibration.status === 'collecting') {
      if (calibration.feed(pose)) {
        game.completeCalibration()
      } else if (!pose.detected) {
        renderer.drawCenteredText('No pose detected — stand in frame', 22, '#ffaa00')
      } else {
        const pct = Math.round(calibration.progress * 100)
        renderer.drawCenteredText('Stand still — calibrating...', 24)
        renderer.drawText(`${pct}%`, renderer.width / 2, renderer.height / 2 + 40, {
          size: 48,
          color: '#00ff88',
        })
      }
    }
  } else if (state === GameState.Ready) {
    renderer.drawText('Calibration complete!', renderer.width / 2, renderer.height / 2 - 25, {
      size: 28,
      color: '#00ff88',
    })
    renderer.drawText('Press SPACE to start', renderer.width / 2, renderer.height / 2 + 25, {
      size: 22,
      color: '#ffffff',
    })
  } else if (state === GameState.Countdown) {
    renderer.drawCenteredText(game.getCountdownNumber(), 96, '#ffffff')
  } else if (state === GameState.Playing) {
    for (const o of game.getObstacles()) {
      o.render(renderer)
    }
    drawStats()

    const cal = calibration.data
    if (cal) {
      const action = gestureDetector.detect(pose, cal, timestamp)
      game.evaluateCollisions(action, pose, timestamp)

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
          `safeL=${action.positionalSafeLeft}  safeR=${action.positionalSafeRight}`,
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
  } else if (state === GameState.GameOver) {
    drawStats()
    renderer.drawCenteredText('Game Over', 48, '#ff4444')
    renderer.drawText(
      'Press SPACE to see results',
      renderer.width / 2,
      renderer.height / 2 + 50,
      { size: 22, color: '#ffffff' },
    )
  } else if (state === GameState.Result) {
    drawResult()
  }

  requestAnimationFrame(gameLoop)
}

requestAnimationFrame(gameLoop)
