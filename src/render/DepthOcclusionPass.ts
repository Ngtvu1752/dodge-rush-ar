import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { DEPTH_OCCLUSION_THRESHOLD, DEPTH_OCCLUSION_SOFT_EDGE } from '../config/gameConfig'
import type { DepthMapData } from '../workers/AITypes'
import { DepthMapProcessor } from './DepthMapProcessor'

const OcclusionShader: THREE.ShaderMaterialParameters = {
  uniforms: {
    tDiffuse: { value: null },
    tSceneDepth: { value: null },
    tAIDepth: { value: null },
    depthThreshold: { value: DEPTH_OCCLUSION_THRESHOLD },
    softEdge: { value: DEPTH_OCCLUSION_SOFT_EDGE },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tSceneDepth;
    uniform sampler2D tAIDepth;
    uniform float depthThreshold;
    uniform float softEdge;
    varying vec2 vUv;

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);

      // Mirror X to match the mirrored webcam feed
      vec2 depthUv = vec2(1.0 - vUv.x, vUv.y);
      float aiDepth = texture2D(tAIDepth, depthUv).r;

      // Scene depth: 1.0=near, 0.0=far (WebGL convention)
      float sceneDepth = texture2D(tSceneDepth, vUv).r;

      // aiDepth: 0.0=near(body), 1.0=far(background)
      // sceneDepth: 1.0=near, 0.0=far
      // Obstacles at z=0 → sceneDepth ≈ 0.5
      // Body pixels → aiDepth ≈ 0.0
      //
      // We want to discard scene pixels that are BEHIND the player body.
      // "Behind" means sceneDepth < aiDepth (scene is farther from camera).
      //
      // smoothstep(edge0, edge1, x):
      //   edge0 = aiDepth - softEdge (slightly in front of body → transparent)
      //   edge1 = aiDepth + softEdge (slightly behind body → opaque)
      //   sceneDepth < edge0 → 0.0 (discard, show video)
      //   sceneDepth > edge1 → 1.0 (keep obstacle)
      float occlusion = smoothstep(aiDepth - softEdge, aiDepth + softEdge, sceneDepth);

      gl_FragColor = vec4(sceneColor.rgb, sceneColor.a * occlusion);
    }
  `,
}

export class DepthOcclusionPass extends Pass {
  private fsQuad: FullScreenQuad
  private material: THREE.ShaderMaterial
  private sceneRT: THREE.WebGLRenderTarget
  private depthTexture: THREE.DepthTexture
  private aiDepthTexture: THREE.DataTexture
  private processor: DepthMapProcessor
  private enabled_ = true

  constructor(width: number, height: number) {
    super()

    this.processor = new DepthMapProcessor()
    this.material = new THREE.ShaderMaterial(OcclusionShader)

    // Scene render target with depth buffer for scene depth extraction
    this.depthTexture = new THREE.DepthTexture(width, height)
    this.depthTexture.format = THREE.DepthFormat
    this.depthTexture.type = THREE.UnsignedIntType

    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      depthTexture: this.depthTexture,
      depthBuffer: true,
    })

    // AI depth map texture (will be updated each frame)
    const size = 256 * 256
    const buffer = new Float32Array(size)
    this.aiDepthTexture = new THREE.DataTexture(buffer, 256, 256, THREE.RedFormat, THREE.FloatType)
    this.aiDepthTexture.needsUpdate = true

    this.fsQuad = new FullScreenQuad(this.material)
  }

  get depthRenderTarget(): THREE.WebGLRenderTarget {
    return this.sceneRT
  }

  updateDepthMap(depthMap: DepthMapData): void {
    this.processor.push(depthMap)
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    // Get temporally smoothed + blurred depth map
    const processed = this.processor.process(performance.now())
    if (processed) {
      this.aiDepthTexture.image = {
        data: processed.buffer,
        width: processed.width,
        height: processed.height,
      }
      this.aiDepthTexture.needsUpdate = true
    }

    this.material.uniforms.tDiffuse.value = readBuffer.texture
    this.material.uniforms.tSceneDepth.value = this.sceneRT.depthTexture
    this.material.uniforms.tAIDepth.value = this.aiDepthTexture

    if (this.renderToScreen) {
      renderer.setRenderTarget(null)
    } else {
      renderer.setRenderTarget(writeBuffer)
    }

    this.fsQuad.render(renderer)
  }

  setSize(width: number, height: number): void {
    const pixelRatio = window.devicePixelRatio
    const w = Math.floor(width * pixelRatio)
    const h = Math.floor(height * pixelRatio)

    this.sceneRT.setSize(w, h)
    this.depthTexture.image = { width: w, height: h, depth: 1 }
    this.depthTexture.needsUpdate = true
  }

  setEnabled(enabled: boolean): void {
    this.enabled_ = enabled
  }

  get isEnabled(): boolean {
    return this.enabled_
  }

  dispose(): void {
    this.processor.dispose()
    this.sceneRT.dispose()
    this.depthTexture.dispose()
    this.aiDepthTexture.dispose()
    this.material.dispose()
    this.fsQuad.dispose()
  }
}
