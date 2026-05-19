import * as THREE from 'three'

export class SceneManager {
  readonly scene: THREE.Scene
  readonly camera: THREE.OrthographicCamera
  private renderer: THREE.WebGLRenderer
  private videoTexture: THREE.VideoTexture | null = null
  private videoPlane: THREE.Mesh | null = null

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.scene = new THREE.Scene()

    const w = window.innerWidth
    const h = window.innerHeight

    // Orthographic camera: (0,0) = top-left, (w, -h) = bottom-right
    // Y-axis is negated to match Canvas2D coordinate system (Y-down)
    this.camera = new THREE.OrthographicCamera(0, w, 0, -h, -1000, 1000)
    this.camera.position.z = 500

    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    // Key light for specular highlights on plastic materials
    const keyLight = new THREE.PointLight(0xffffff, 0.8, 2000)
    keyLight.position.set(w / 2, -h * 0.3, 600)
    this.scene.add(keyLight)

    window.addEventListener('resize', () => this.resize())
  }

  setBackgroundVideo(video: HTMLVideoElement): void {
    const w = window.innerWidth
    const h = window.innerHeight

    this.videoTexture = new THREE.VideoTexture(video)
    this.videoTexture.minFilter = THREE.LinearFilter
    this.videoTexture.magFilter = THREE.LinearFilter
    this.videoTexture.format = THREE.RGBAFormat
    // Mirror horizontally to match mirrored webcam feed
    this.videoTexture.wrapS = THREE.RepeatWrapping
    this.videoTexture.repeat.x = -1

    // Create plane sized to cover screen (like object-fit: cover)
    const geometry = this.createVideoGeometry(w, h, video)
    const material = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthWrite: false,
    })
    this.videoPlane = new THREE.Mesh(geometry, material)
    this.videoPlane.position.set(w / 2, -h / 2, -500)
    this.scene.add(this.videoPlane)
  }

  private createVideoGeometry(screenW: number, screenH: number, video: HTMLVideoElement): THREE.PlaneGeometry {
    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720
    const screenAspect = screenW / screenH
    const videoAspect = vw / vh

    let planeW = screenW
    let planeH = screenH
    if (videoAspect > screenAspect) {
      // Video is wider — scale by height, extend width
      planeW = screenH * videoAspect
    } else {
      // Video is taller — scale by width, extend height
      planeH = screenW / videoAspect
    }
    return new THREE.PlaneGeometry(planeW, planeH)
  }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight

    this.camera.left = 0
    this.camera.right = w
    this.camera.top = 0
    this.camera.bottom = -h
    this.camera.updateProjectionMatrix()

    if (this.videoPlane && this.videoTexture?.image) {
      this.videoPlane.geometry.dispose()
      this.videoPlane.geometry = this.createVideoGeometry(w, h, this.videoTexture.image as HTMLVideoElement)
      this.videoPlane.position.set(w / 2, -h / 2, -500)
    }
  }

  render(): void {
    if (this.videoTexture) {
      this.videoTexture.needsUpdate = true
    }
    this.renderer.render(this.scene, this.camera)
  }
}
