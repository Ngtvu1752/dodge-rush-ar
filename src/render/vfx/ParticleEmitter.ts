import * as THREE from 'three'

interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  r: number
  g: number
  b: number
}

export type ParticlePreset = 'success' | 'fail' | 'sparkle'

const POOL_SIZE = 200

const PRESETS: Record<ParticlePreset, { count: number; speed: number; gravity: number; life: number; size: number; colors: [number, number, number][] }> = {
  success: {
    count: 25,
    speed: 200,
    gravity: 300,
    life: 0.8,
    size: 6,
    colors: [[0, 1, 0.53], [0.5, 1, 0.7], [1, 1, 1]],
  },
  fail: {
    count: 30,
    speed: 250,
    gravity: 400,
    life: 0.6,
    size: 5,
    colors: [[1, 0.27, 0.27], [1, 0.5, 0], [1, 1, 0.5]],
  },
  sparkle: {
    count: 15,
    speed: 80,
    gravity: 50,
    life: 1.2,
    size: 4,
    colors: [[0.3, 0.5, 1], [0.5, 0.7, 1], [1, 1, 1]],
  },
}

export class ParticleEmitter {
  private scene: THREE.Scene
  private particles: Particle[] = []
  private pointsGeometry: THREE.BufferGeometry
  private pointsMesh: THREE.Points
  private positions: Float32Array
  private colors: Float32Array
  private sizes: Float32Array

  constructor(scene: THREE.Scene) {
    this.scene = scene

    this.positions = new Float32Array(POOL_SIZE * 3)
    this.colors = new Float32Array(POOL_SIZE * 3)
    this.sizes = new Float32Array(POOL_SIZE)

    this.pointsGeometry = new THREE.BufferGeometry()
    this.pointsGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.pointsGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.pointsGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))

    // Create a circular particle texture via canvas
    const texCanvas = document.createElement('canvas')
    texCanvas.width = 32
    texCanvas.height = 32
    const texCtx = texCanvas.getContext('2d')!
    const gradient = texCtx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    texCtx.fillStyle = gradient
    texCtx.fillRect(0, 0, 32, 32)
    const texture = new THREE.CanvasTexture(texCanvas)

    const material = new THREE.PointsMaterial({
      size: 8,
      map: texture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.pointsMesh = new THREE.Points(this.pointsGeometry, material)
    this.scene.add(this.pointsMesh)
  }

  burst(screenX: number, screenY: number, preset: ParticlePreset): void {
    const config = PRESETS[preset]

    for (let i = 0; i < config.count; i++) {
      if (this.particles.length >= POOL_SIZE) break

      const angle = Math.random() * Math.PI * 2
      const speed = config.speed * (0.5 + Math.random() * 0.5)
      const color = config.colors[Math.floor(Math.random() * config.colors.length)]

      this.particles.push({
        x: screenX,
        y: -screenY, // negate for Three.js Y-down
        z: 0,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed, // negate for Three.js
        vz: (Math.random() - 0.5) * 50,
        life: config.life * (0.7 + Math.random() * 0.3),
        maxLife: config.life,
        size: config.size * (0.6 + Math.random() * 0.8),
        r: color[0],
        g: color[1],
        b: color[2],
      })
    }
  }

  update(dt: number): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }

      p.vy += PRESETS.success.gravity * dt // gravity pulls down (positive = down in Three.js)
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
    }

    // Update buffer attributes
    for (let i = 0; i < POOL_SIZE; i++) {
      const i3 = i * 3
      if (i < this.particles.length) {
        const p = this.particles[i]
        const lifeRatio = p.life / p.maxLife
        this.positions[i3] = p.x
        this.positions[i3 + 1] = p.y
        this.positions[i3 + 2] = p.z
        this.colors[i3] = p.r * lifeRatio
        this.colors[i3 + 1] = p.g * lifeRatio
        this.colors[i3 + 2] = p.b * lifeRatio
        this.sizes[i] = p.size * lifeRatio
      } else {
        // Hide unused particles far off-screen
        this.positions[i3] = 0
        this.positions[i3 + 1] = 0
        this.positions[i3 + 2] = -9999
        this.sizes[i] = 0
      }
    }

    this.pointsGeometry.attributes.position.needsUpdate = true
    this.pointsGeometry.attributes.color.needsUpdate = true
    this.pointsGeometry.attributes.size.needsUpdate = true
  }

  dispose(): void {
    this.scene.remove(this.pointsMesh)
    this.pointsGeometry.dispose()
    ;(this.pointsMesh.material as THREE.Material).dispose()
  }
}
