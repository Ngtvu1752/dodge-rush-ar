import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const ctx = canvas.getContext('2d')!

function resize() {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

window.addEventListener('resize', resize)
resize()

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#ffffff'
  ctx.font = '24px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('Dodge Rush AR — Ready for Phase 1', canvas.width / 2, canvas.height / 2)

  requestAnimationFrame(gameLoop)
}

requestAnimationFrame(gameLoop)
