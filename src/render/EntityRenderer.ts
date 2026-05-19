import * as THREE from 'three'

export class EntityRenderer {
  readonly renderer: THREE.WebGLRenderer

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setClearAlpha(0)

    window.addEventListener('resize', () => this.resize())
  }

  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera)
  }

  dispose(): void {
    this.renderer.dispose()
  }
}
