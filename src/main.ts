import './style.css'
import { CameraManager } from './camera/CameraManager'
import { Renderer } from './render/Renderer'
import { PoseTracker } from './pose/PoseTracker'
import { PoseSmoother } from './pose/PoseSmoother'
import { DebugSkeleton } from './render/DebugSkeleton'

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const renderer = new Renderer(canvas)
const camera = new CameraManager('webcam')
const poseTracker = new PoseTracker()
const poseSmoother = new PoseSmoother()
const debugSkeleton = new DebugSkeleton()

let debugMode = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    debugMode = !debugMode
  }
})

camera.init().then((ok) => {
  if (!ok) {
    console.error(camera.errorMessage)
    return
  }
  poseTracker.init().then((loaded) => {
    if (!loaded) {
      console.error(poseTracker.error)
    }
  })
})

function gameLoop(timestamp: number) {
  renderer.clear()

  if (camera.isReady) {
    renderer.drawVideo(camera.getVideo())

    if (debugMode) {
      if (poseTracker.ready) {
        const raw = poseTracker.detect(camera.getVideo(), timestamp)
        const pose = poseSmoother.smooth(raw)
        debugSkeleton.draw(renderer, pose)
      } else if (poseTracker.error) {
        renderer.drawCenteredText('Pose model failed to load', 20, '#ff4444')
      } else {
        renderer.drawCenteredText('Loading pose model...', 20, '#888888')
      }
    }
  } else if (camera.status === 'error') {
    renderer.drawMultilineCentered(camera.errorMessage, 20, '#ff4444')
  } else if (camera.status === 'requesting') {
    renderer.drawCenteredText('Requesting camera access...', 24)
  } else {
    renderer.drawCenteredText('Dodge Rush AR — Initializing...', 24)
  }

  requestAnimationFrame(gameLoop)
}

requestAnimationFrame(gameLoop)
