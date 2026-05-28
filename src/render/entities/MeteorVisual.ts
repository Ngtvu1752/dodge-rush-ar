import * as THREE from 'three'
import gsap from 'gsap'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { VisualAdapter } from './VisualAdapter'
import type { Obstacle } from '../../entities/Obstacle'
import type { Meteor } from '../../entities/Meteor'
import { METEOR_HIT_ZONE_Z, METEOR_SCREEN_RADIUS, METEOR_SPAWN_Z } from '../../config/gameConfig'

const MODEL_PATH = '/assets/1999_RQ36_asteroid.glb'
const BASE_MODEL_SIZE = 120

let cachedModel: THREE.Group | null = null
let loadPromise: Promise<THREE.Group> | null = null

function cloneMaterial(material: THREE.Material): THREE.Material {
  const cloned = material.clone()

  if (cloned instanceof THREE.MeshStandardMaterial || cloned instanceof THREE.MeshPhysicalMaterial) {
    cloned.color.multiplyScalar(0.9)
    cloned.roughness = Math.min(1, cloned.roughness + 0.18)
    cloned.metalness *= 0.15
    cloned.envMapIntensity = 0.8
    cloned.transparent = true
  }

  return cloned
}

function prepareModelTemplate(model: THREE.Group): THREE.Group {
  const centered = model.clone(true)

  centered.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      mesh.geometry.computeVertexNormals()
      mesh.castShadow = true
      mesh.receiveShadow = true

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => cloneMaterial(material))
      } else {
        mesh.material = cloneMaterial(mesh.material)
      }
    }
  })

  const box = new THREE.Box3().setFromObject(centered)
  const center = box.getCenter(new THREE.Vector3())
  centered.position.sub(center)

  cachedModel = centered
  return centered
}

function loadModel(): Promise<THREE.Group> {
  if (cachedModel) return Promise.resolve(cachedModel)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      MODEL_PATH,
      (gltf) => resolve(prepareModelTemplate(gltf.scene)),
      undefined,
      (err) => {
        console.error('[MeteorVisual] Failed to load GLB:', err)
        reject(err)
      },
    )
  })

  return loadPromise
}

export class MeteorVisual implements VisualAdapter {
  private group: THREE.Group
  private mesh: THREE.Group | null = null
  private haloMesh: THREE.Mesh | null = null
  private emberLight: THREE.PointLight
  private materials: Array<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial> = []
  private baseScale = 1
  private prevResult: string | null = null
  private scaleMultiplier = 1
  private opacityMultiplier = 1
  private projectilePulse = 0

  constructor() {
    this.group = new THREE.Group()
    this.emberLight = new THREE.PointLight(0xff6a1a, 0, 420, 2)
    this.emberLight.position.set(0, 0, 50)
    this.group.add(this.emberLight)

    loadModel().then((model) => {
      this.mesh = model.clone(true)
      this.materials = []

      this.mesh.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        const mesh = child as THREE.Mesh

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((material) => cloneMaterial(material))
          for (const material of mesh.material) {
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
              this.materials.push(material)
            }
          }
        } else {
          const material = cloneMaterial(mesh.material)
          mesh.material = material
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            this.materials.push(material)
          }
        }
      })

      const box = new THREE.Box3().setFromObject(this.mesh)
      const size = box.getSize(new THREE.Vector3())
      const sphere = box.getBoundingSphere(new THREE.Sphere())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim > 0) {
        this.baseScale = BASE_MODEL_SIZE / maxDim
      }

      this.mesh.scale.setScalar(this.baseScale)
      this.group.add(this.mesh)

      const halo = new THREE.Mesh(
        new THREE.IcosahedronGeometry(Math.max(sphere.radius * 1.08, 0.8), 1),
        new THREE.MeshBasicMaterial({
          color: 0xff7a2f,
          transparent: true,
          opacity: 0.08,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      halo.scale.setScalar(this.baseScale)
      this.haloMesh = halo
      this.group.add(halo)
    }).catch(() => {
      this.mesh = null
    })
  }

  sync(obstacle: Obstacle, _canvasW: number, _canvasH: number): void {
    const meteor = obstacle as Obstacle & Meteor

    const cx = meteor.centerX
    const cy = -meteor.centerY
    const cz = -meteor.worldZ
    this.group.position.set(cx, cy, cz)

    const perspScale = meteor.screenRadius > 0
      ? meteor.screenRadius / METEOR_SCREEN_RADIUS
      : 0.01

    if (this.mesh) {
      this.mesh.scale.setScalar(this.baseScale * perspScale * this.scaleMultiplier)
      this.mesh.rotation.x = meteor.rotX
      this.mesh.rotation.y = meteor.rotY
      this.mesh.rotation.z = Math.sin(meteor.rotY * 0.45) * 0.18
    }

    if (this.haloMesh) {
      this.haloMesh.scale.setScalar(this.baseScale * perspScale * 1.12 * this.scaleMultiplier)
      this.haloMesh.rotation.y = -meteor.rotY * 0.35
      this.haloMesh.rotation.z += 0.004
    }

    const depthHeat = THREE.MathUtils.clamp(1 - (meteor.worldZ / METEOR_SPAWN_Z), 0, 1)
    const hitHeat = meteor.inHitZone ? 1 : 0
    const emberStrength = THREE.MathUtils.lerp(0.15, 1.25, depthHeat * 0.7 + hitHeat * 0.3)

    for (const material of this.materials) {
      material.emissive.setRGB(0.42, 0.12, 0.03)
      material.emissiveIntensity = emberStrength * 0.45
      material.opacity = this.opacityMultiplier
    }

    if (this.haloMesh) {
      const haloMaterial = this.haloMesh.material as THREE.MeshBasicMaterial
      haloMaterial.opacity = (0.05 + emberStrength * 0.12 + (meteor.worldZ <= METEOR_HIT_ZONE_Z ? 0.08 : 0)) * this.opacityMultiplier
      haloMaterial.color.set(meteor.inHitZone ? 0xffb15c : 0xff7a2f)
    }

    this.emberLight.intensity = 0.15 + emberStrength * 1.6
    this.emberLight.distance = 280 + emberStrength * 180
    if (this.projectilePulse > 0) {
      this.projectilePulse = Math.max(0, this.projectilePulse - 0.08)
      this.emberLight.intensity += this.projectilePulse * 3.5
    }

    if (obstacle.result && obstacle.result !== this.prevResult) {
      if (obstacle.result === 'fail') {
        this.playHitFlash()
      } else if (obstacle.result === 'success') {
        if (obstacle.resultCause === 'projectile') {
          this.playProjectileBurst()
        } else {
          this.playDodgeFade()
        }
      }
      this.prevResult = obstacle.result
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.group)
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        const mesh = child as THREE.Mesh
        mesh.geometry.dispose()

        if (Array.isArray(mesh.material)) {
          for (const material of mesh.material) material.dispose()
        } else {
          mesh.material.dispose()
        }
      })
    }

    if (this.haloMesh) {
      this.haloMesh.geometry.dispose()
      ;(this.haloMesh.material as THREE.Material).dispose()
    }
  }

  private playHitFlash(): void {
    for (const material of this.materials) {
      gsap.killTweensOf(material)
      material.emissive.set(0xffffff)
      material.emissiveIntensity = 2.2
      gsap.to(material, {
        emissiveIntensity: 0.5,
        duration: 0.45,
        ease: 'power2.out',
        onComplete: () => {
          material.emissive.setRGB(0.42, 0.12, 0.03)
        },
      })
    }

    gsap.killTweensOf(this.emberLight)
    gsap.to(this.emberLight, {
      intensity: 3.2,
      duration: 0.12,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
    })
  }

  private playDodgeFade(): void {
    if (this.mesh) {
      gsap.killTweensOf(this)
      gsap.to(this, {
        scaleMultiplier: 0.12,
        opacityMultiplier: 0,
        duration: 0.35,
        ease: 'power3.in',
      })
    }

    if (this.haloMesh) {
      const haloMaterial = this.haloMesh.material as THREE.MeshBasicMaterial
      gsap.killTweensOf(haloMaterial)
      gsap.to(haloMaterial, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    for (const material of this.materials) {
      gsap.killTweensOf(material)
      gsap.to(material, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.out',
      })
    }
  }

  private playProjectileBurst(): void {
    gsap.killTweensOf(this)
    this.scaleMultiplier = 1
    this.opacityMultiplier = 1
    this.projectilePulse = 1

    for (const material of this.materials) {
      gsap.killTweensOf(material)
      material.emissive.set(0xffd6a0)
      material.emissiveIntensity = 2.8
      gsap.to(material, {
        opacity: 0,
        emissiveIntensity: 0.15,
        duration: 0.28,
        ease: 'power2.out',
      })
    }

    gsap.to(this, {
      scaleMultiplier: 1.36,
      opacityMultiplier: 0,
      duration: 0.34,
      ease: 'power3.out',
    })

    if (this.haloMesh) {
      const haloMaterial = this.haloMesh.material as THREE.MeshBasicMaterial
      gsap.killTweensOf(haloMaterial)
      haloMaterial.opacity = 0.55
      haloMaterial.color.set(0xffdcb3)
      gsap.to(haloMaterial, {
        opacity: 0,
        duration: 0.24,
        ease: 'power2.out',
      })
    }
  }
}
