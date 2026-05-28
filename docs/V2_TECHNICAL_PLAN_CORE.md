# V2 Technical Plan: Core Architecture

## Dodge Rush AR V2.0 — Deep Interaction & Spatial Awareness

This document defines the architectural paradigm shift required to evolve Dodge Rush AR from a 2D webcam overlay into a true Spatial/Mixed Reality application. It covers three foundational pillars: off-main-thread AI inference, depth-aware occlusion rendering, and multi-model synchronization.

---

## 1. The Architectural Problem

### V1 Bottleneck Analysis

The current V1 pipeline runs **everything on the main thread** in a single `requestAnimationFrame` loop:

```
Main Thread (60 FPS target):
┌─────────────────────────────────────────────────────┐
│  1. game.update(dt)           ~0.5ms                │
│  2. poseTracker.detect()      ~8-15ms  ← BOTTLENECK │
│  3. poseSmoother.smooth()     ~0.1ms                 │
│  4. obstacleVisualManager.sync()  ~1ms               │
│  5. gestureDetection + collision  ~0.5ms             │
│  6. feedback / particles      ~1ms                   │
│  7. sceneManager.render()     ~4-8ms   ← GPU-bound   │
│  8. domUI.update()            ~0.5ms                 │
│                                                      │
│  Total: ~16-26ms per frame (38-60 FPS)               │
└─────────────────────────────────────────────────────┘
```

Adding Hand Landmarker (~10-20ms) + Depth Estimation (~15-30ms) + Object Tracking (~5-10ms) would push frame time to **46-86ms (11-21 FPS)** — unplayable.

### The Paradigm Shift

V2 separates inference from rendering into a **multi-threaded pipeline**:

```
┌──────────────────────┐     ┌──────────────────────────────────┐
│    MAIN THREAD       │     │       AI WORKER THREAD           │
│    (Render Loop)     │     │    (Inference Pipeline)          │
│                      │     │                                  │
│  requestAnimFrame    │     │  onmessage: receive video frame  │
│  ├─ read last result │     │  ├─ Pose Landmarker      ~8ms   │
│  ├─ update game      │     │  ├─ Hand Landmarker     ~12ms   │
│  ├─ render Three.js  │     │  ├─ Depth Estimator     ~18ms   │
│  ├─ update DOM UI    │     │  └─ postMessage(results)         │
│  └─ ~6-10ms budget   │     │     Total: ~38-40ms              │
│                      │     │     (runs async, no frame drop)  │
│  postMessage(frame)  │────>│                                  │
│                      │<────│  postMessage(results)            │
└──────────────────────┘     └──────────────────────────────────┘
```

**Key insight**: The main thread never waits for inference. It always renders with the *most recent completed* AI result, accepting 1-2 frames of latency (~16-33ms) in exchange for a rock-solid 60 FPS render loop.

---

## 2. Web Worker Architecture

### 2.1 Why a Single AI Worker (Not Multiple)

Running Pose, Hands, and Depth in **separate** workers seems logical but creates problems:

- Each worker loads its own MediaPipe WASM runtime (~4MB)
- Each worker needs its own WebGL context for GPU inference
- Browser GPU context limits (typically 8-16 per page)
- Cross-worker coordination overhead

**Recommended approach**: Single AI Worker running all three models sequentially on each frame. This is viable because:

- MediaPipe models share the same WASM runtime
- Sequential execution on one thread avoids GPU context contention
- Total inference time (~38ms) still allows ~25 AI FPS — above the 20 FPS target
- A single message channel simplifies synchronization

If profiling later shows the single worker can't maintain 20+ AI FPS, models can be split into two workers (Pose+Hands in one, Depth in another) with staggered scheduling.

### 2.2 Communication Protocol

```typescript
// ── Shared Types (src/workers/AITypes.ts) ──

/** Main thread → Worker: video frame data */
interface AIFrameRequest {
  type: 'frame';
  timestamp: number;
  imageData: ImageData;          // Raw pixels from canvas
  width: number;
  height: number;
}

/** Worker → Main thread: all inference results bundled */
interface AIFrameResult {
  type: 'result';
  timestamp: number;             // Echo back for latency measurement
  frameId: number;               // Monotonic counter for dropped-frame detection

  pose: PoseData | null;         // 13 landmarks (existing format)
  hands: HandData | null;        // 2 × 21 landmarks
  depth: DepthMapData | null;    // Downsampled depth buffer

  inferenceMs: {
    pose: number;
    hands: number;
    depth: number;
    total: number;
  };
}

/** Main thread → Worker: lifecycle commands */
type AICommand =
  | { type: 'init'; config: AIWorkerConfig }
  | { type: 'calibrate'; calibrationData: CalibrationData }
  | { type: 'setModels'; pose: boolean; hands: boolean; depth: boolean }
  | { type: 'destroy' };
```

### 2.3 The AI Worker Implementation

```
src/workers/
├─ ai.worker.ts              # Worker entry point — runs inference loop
├─ AITypes.ts                # Shared TypeScript interfaces
├─ AIWorkerManager.ts        # Main-thread side: manages worker lifecycle
├─ InferenceScheduler.ts     # Decides which models to run per frame
└─ models/
   ├─ PoseModel.ts           # Pose Landmarker wrapper
   ├─ HandModel.ts           # Hand Landmarker wrapper
   └─ DepthModel.ts          # Depth Estimator wrapper
```

**Worker entry point** (`ai.worker.ts`):

```typescript
// Pseudocode — not runnable, shows architecture
import { PoseLandmarker, HandLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';

let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let depthEstimator: DepthEstimator | null = null;

self.onmessage = async (e: MessageEvent<AICommand | AIFrameRequest>) => {
  if (e.data.type === 'init') {
    // Load models using GPU delegate (WebGL in OffscreenCanvas)
    // Models load from CDN, same as V1
  }

  if (e.data.type === 'frame') {
    const start = performance.now();
    const { imageData, timestamp } = e.data;

    // Create OffscreenCanvas for MediaPipe (required for VIDEO mode)
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    // Sequential inference — each model gets the same frame
    const pose = poseLandmarker?.detectForVideo(canvas, timestamp) ?? null;
    const hands = handLandmarker?.detectForVideo(canvas, timestamp) ?? null;
    const depth = depthEstimator?.estimateDepth(canvas, timestamp) ?? null;

    // Transfer results back (use Transferable for depth buffer)
    self.postMessage({
      type: 'result',
      timestamp,
      frameId: e.data.frameId,
      pose: mapPoseResults(pose),
      hands: mapHandResults(hands),
      depth: mapDepthResults(depth),
      inferenceMs: { /* ... */ }
    });
  }
};
```

### 2.4 Frame Transfer Optimization

Sending `ImageData` via `postMessage` involves a **structured clone** (copy) of the pixel buffer. For 1280×720 RGBA, that's **3.7MB per frame** — too expensive at 30+ FPS.

**Solution**: Use `Transferable` objects with `OffscreenCanvas`:

```typescript
// Option A: OffscreenCanvas (preferred — zero-copy)
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ type: 'frame', canvas: offscreen, timestamp }, [offscreen]);
// Canvas is transferred (not copied), main thread loses access until returned

// Option B: ImageBitmap (good fallback — near-zero-copy)
const bitmap = await createImageBitmap(video);
worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]);

// Option C: SharedArrayBuffer (maximum control, requires COOP/COEP headers)
// Not recommended for this project due to header requirements
```

**Recommended**: Option B (`ImageBitmap`) — works in all modern browsers, no special headers needed, and `createImageBitmap()` is fast (~1ms).

### 2.5 Vite Configuration for Workers

Vite supports workers out of the box with `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`. However, MediaPipe's WASM assets need special handling:

```typescript
// vite.config.ts additions
export default defineConfig({
  worker: {
    format: 'es',                    // ES module workers
    rollupOptions: {
      output: { entryFileNames: 'assets/[name]-[hash].js' }
    }
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']  // Don't pre-bundle MediaPipe
  }
});
```

---

## 3. Depth Occlusion Shader

### 3.1 The Problem

Current V1 obstacles render on top of the video feed with no awareness of the player's body in 3D space. When a virtual Red Wall passes "behind" the player, it should be hidden — but currently it draws over the player's body, breaking immersion.

### 3.2 Depth Map from MediaPipe

MediaPipe provides depth estimation via **Image Segmenter** with the `selfie_multiclass_256x256` model, which outputs a confidence mask per body part. For true depth, we use the **Depth Anything V2** model (via MediaPipe's custom model support) or the built-in `selfie_depth` model which outputs a monocular depth map.

**Recommended model**: `depth_anything_v2_small` — a monocular depth estimator that produces per-pixel depth values from a single RGB image. It runs at ~18ms on a mid-range GPU via MediaPipe's WebGPU delegate.

**Output format**: A single-channel float32 buffer (256×256 or 128×128 downsampled), where each value represents relative depth (0.0 = near camera, 1.0 = far). This is **not metric depth** — it's a relative depth map, which is sufficient for occlusion.

### 3.3 Occlusion Compositing Pipeline

The occlusion effect uses a **depth-test compositing** approach in Three.js. Instead of modifying every obstacle shader, we use a **full-screen post-processing pass** that compares the depth map against the rendered 3D scene.

```
Frame N Rendering Pipeline:
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Render video frame to quad (existing)              │
│          → Screen shows mirrored webcam feed                 │
│                                                              │
│  Step 2: Upload AI depth map as THREE.DataTexture            │
│          → depthTexture (128×128, R32F format)               │
│                                                              │
│  Step 3: Render all 3D obstacles to an offscreen FBO         │
│          → sceneRenderTarget (RGBA, full resolution)          │
│          → Also writes obstacle depth to depthBuffer          │
│                                                              │
│  Step 4: Full-screen compositing pass                        │
│          For each pixel:                                      │
│            realDepth = sample(depthTexture, uv)               │
│            obstacleDepth = sample(depthBuffer, uv)            │
│            obstacleColor = sample(sceneRenderTarget, uv)      │
│                                                              │
│            if (obstacleDepth < realDepth):                    │
│              // Obstacle is IN FRONT of player → draw it      │
│              output = obstacleColor                           │
│            else:                                              │
│              // Obstacle is BEHIND player → discard           │
│              output = videoColor (transparent for WebGL)      │
│                                                              │
│  Step 5: Composite result over video background              │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Three.js Implementation Strategy

```typescript
// Pseudocode — DepthOcclusionPass.ts

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const DepthOcclusionShader = {
  uniforms: {
    tDiffuse: { value: null },           // Scene render
    tDepthMap: { value: null },          // AI depth map (player body)
    tSceneDepth: { value: null },        // 3D scene depth buffer
    depthThreshold: { value: 0.05 },     // Bias to prevent z-fighting
    resolution: { value: new THREE.Vector2() }
  },
  vertexShader: `/* standard fullscreen quad */`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepthMap;
    uniform sampler2D tSceneDepth;
    uniform float depthThreshold;

    void main() {
      vec4 sceneColor = texture2D(tDiffuse, vUv);
      float aiDepth = texture2D(tDepthMap, vUv).r;      // 0=near, 1=far
      float objDepth = texture2D(tSceneDepth, vUv).r;    // Linearized scene depth

      // If obstacle is behind the player's body, hide it
      if (objDepth > aiDepth + depthThreshold) {
        discard;  // Show video feed instead
      }

      gl_FragColor = sceneColor;
    }
  `
};
```

### 3.5 Coordinate Space Alignment

The AI depth map (128×128) and the scene depth buffer (full resolution) must share the same coordinate space. Key considerations:

- **UV mapping**: The depth map covers the webcam FOV. The 3D scene uses an orthographic camera. UV coordinates must match — use `vUv = gl_FragCoord.xy / resolution` for the compositing pass, and ensure the depth map is stretched/fit to the same aspect ratio.
- **Depth linearization**: Three.js's default depth buffer is non-linear (hyperbolic). Use `linearizeDepth()` to convert to the same linear scale as the AI depth map.
- **Mirroring**: The webcam feed is mirrored (`texture.repeat.x = -1`). The depth map must be mirrored identically before comparison.
- **Temporal smoothing**: The AI depth map updates at ~25 FPS while rendering runs at 60 FPS. Interpolate between the last two depth maps to prevent flickering at occlusion boundaries.

### 3.6 Limitations and Fallbacks

| Limitation | Impact | Mitigation |
|---|---|---|
| Monocular depth is relative, not metric | Occlusion boundaries may not align perfectly with body edges | Use confidence thresholding — only occlude when AI depth confidence > 0.7 |
| Depth map is low-res (128×128) | Jagged occlusion edges | Apply Gaussian blur to depth map; use soft threshold (alpha blend over 0.05 depth range) |
| Depth model adds ~18ms inference | Reduces AI FPS from ~30 to ~25 | Make depth optional; enable only on capable hardware (`navigator.gpu` check) |
| Depth estimation fails in low light | No occlusion | Graceful fallback: render obstacles without occlusion (V1 behavior) |

---

## 4. Hand Tracking Integration

### 4.1 MediaPipe Hand Landmarker

Hand Landmarker detects **21 landmarks per hand** (up to 2 hands simultaneously). Each landmark has (x, y, z) in normalized image coordinates plus a visibility score.

**Key landmarks for gameplay**:

```
Hand Landmarks (21 points):
     8  ← Index tip     (pinch detection)
    / 
   4   ← Thumb tip      (pinch detection)
   |
   0   ← Wrist          (position tracking)
   |
   ... (17 intermediate joints for gesture shape)
```

### 4.2 Gesture Recognition Pipeline

The hand tracking system needs to recognize several gestures beyond simple proximity:

Architecture note: body locomotion and hand interaction should stay on separate channels. `GestureDetector` should output only body actions (`dodgeLeft`, `dodgeRight`, `squat`), while hand pinch/grab/release state, confidence, and velocity remain owned by `HandTracker`.

```typescript
interface HandState {
  landmarks: Point[];           // 21 landmarks, normalized
  isPinching: boolean;          // Thumb tip ↔ Index tip < threshold
  pinchStrength: number;        // 0.0 (open) → 1.0 (fully pinched)
  isGrabbing: boolean;          // All fingers curled
  palmCenter: Point;            // Average of wrist + middle MCP
  palmNormal: Point;            // Cross product for orientation
  velocity: Point;              // Frame-over-frame movement (for throwing)
  confidence: number;           // Detection confidence
}
```

**Pinch detection** (thumb tip #4 ↔ index tip #8):

```typescript
function isPinching(landmarks: Point[], threshold: number): boolean {
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const dist = distance(thumbTip, indexTip);
  // threshold ≈ 0.05 in normalized coords (adjustable via calibration)
  return dist < threshold;
}
```

**Throw velocity** calculation (last N frames of wrist movement):

```typescript
function calculateThrowVelocity(
  history: Point[],    // Last 5 frames of wrist position
  dt: number           // Time span of history
): { vx: number; vy: number; speed: number } {
  if (history.length < 2) return { vx: 0, vy: 0, speed: 0 };
  const first = history[0];
  const last = history[history.length - 1];
  const vx = (last.x - first.x) / dt;
  const vy = (last.y - first.y) / dt;
  return { vx, vy, speed: Math.sqrt(vx * vx + vy * vy) };
}
```

### 4.3 Physics Model for Thrown Objects

For the "grab Blue Orb, throw at Red Wall" mechanic, we need a simple physics model. **Matter.js is overkill** — a lightweight custom vector math approach is sufficient:

```typescript
interface ThrownOrb {
  position: { x: number; y: number };    // Canvas coords
  velocity: { x: number; y: number };    // Pixels/sec
  rotation: number;                       // Visual spin
  lifetime: number;                       // Seconds until auto-destroy
  damage: number;                         // Points on hit
}

// Update per frame
function updateThrownOrb(orb: ThrownOrb, dt: number): void {
  orb.position.x += orb.velocity.x * dt;
  orb.position.y += orb.velocity.y * dt;
  orb.velocity.y += 200 * dt;             // Gentle gravity (arc trajectory)
  orb.rotation += 5 * dt;                 // Visual spin
  orb.lifetime -= dt;

  // Simple drag to prevent infinite speed
  orb.velocity.x *= 0.998;
  orb.velocity.y *= 0.998;
}
```

**Collision with Red Walls**: AABB overlap between thrown orb position and wall bounds. On hit: wall is destroyed, player scores bonus points, satisfying particle burst.

For the current Stage C rollout, this projectile path should also support Meteor as a valid target. Laser deflection should remain deferred to the later hand-polish phase rather than being required for the core grab/throw slice.

BlueOrb interaction policy for Stage C should be hybrid but prioritized: if hands are interaction-available, candidate/grab flow suppresses wrist-touch resolution for that orb. If hands are unavailable, V1-style touch remains the fallback interaction.

### 4.4 Hand Tracking Performance Budget

| Metric | Value |
|---|---|
| Model | `hand_landmarker_lite` (recommended) |
| Inference time | ~10-14ms (GPU delegate) |
| Max hands | 2 |
| Landmarks per hand | 21 |
| Input resolution | 256×256 (auto-resized by MediaPipe) |

---

## 5. Tangible Object Tracking

### 5.1 Approach: Color-Based Tracking (Recommended)

For tracking a physical colored object (e.g., a bright green ball, orange controller), **color-based tracking in HSV space** is the most reliable and performant approach. It doesn't require a trained model and runs in ~2-5ms.

**Why not MediaPipe Object Detection?**
- Generic object detection models are heavy (~50ms inference)
- They detect *categories*, not specific objects
- Color tracking is sufficient for a known prop

**Why not OpenCV.js?**
- OpenCV.js is 8MB+ and adds significant bundle size
- The color tracking algorithm is simple enough to implement in ~50 lines of vanilla JS

### 5.2 Color Tracking Algorithm

```typescript
interface TrackedObject {
  detected: boolean;
  center: Point;           // Normalized coordinates
  radius: number;          // Approximate size in pixels
  confidence: number;      // 0-1, based on blob density
}

function trackColorObject(
  imageData: ImageData,
  targetHSV: { h: number; s: number; v: number },  // Calibrated target color
  tolerance: { h: number; s: number; v: number }    // ± range
): TrackedObject {
  const { data, width, height } = imageData;
  let sumX = 0, sumY = 0, count = 0;

  // Scan every 4th pixel for performance (downsampled search)
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      const hsv = rgbToHsv(data[i], data[i + 1], data[i + 2]);

      if (Math.abs(hsv.h - targetHSV.h) < tolerance.h &&
          Math.abs(hsv.s - targetHSV.s) < tolerance.s &&
          Math.abs(hsv.v - targetHSV.v) < tolerance.v) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count < 20) return { detected: false, center: { x: 0, y: 0 }, radius: 0, confidence: 0 };

  return {
    detected: true,
    center: { x: sumX / count / width, y: sumY / count / height },
    radius: Math.sqrt(count / Math.PI) * 4,  // Approximate radius
    confidence: Math.min(count / 200, 1.0)
  };
}
```

### 5.3 Weapon/Shield Mapping

The tracked object's position and orientation determine where the 3D weapon renders:

```
Physical object (tracked via color)
        ↓
   ┌────────────┐
   │ Position   │ → 3D weapon position on screen
   │ Size       │ → Weapon scale (distance proxy)
   │ Movement   │ → Weapon trail/slash effect
   └────────────┘
```

**Weapon types** (unlockable via game progression):
- **Shield**: Block Red Walls when positioned in their path
- **Sword**: Slash through High Lasers to destroy them
- **Wand**: Enhanced Blue Orb throwing (larger grab radius, homing)

### 5.4 Calibration Flow

The player must calibrate the tracked object before use:

1. Game displays "Hold up your [color] object"
2. Player clicks/taps to sample the object's color from the center of the frame
3. System stores HSV target + tolerance
4. Live preview shows tracked blob with green highlight
5. Player confirms → calibration saved

---

## 6. Synchronization Strategy

### 6.1 The Latency Problem

The AI Worker runs at ~25 FPS (38-40ms per inference cycle). The main thread renders at 60 FPS (16.6ms per frame). This creates a fundamental timing mismatch:

```
Main Thread:  |---F1---|---F2---|---F3---|---F4---|---F5---|---F6---|
AI Worker:    |------Inference 1------|------Inference 2------|
                ↑                       ↑
              Result 1 available      Result 2 available
```

Frames F2-F3 use Result 1 (slightly stale). Frame F4+ uses Result 2. The staleness window is 0-38ms, averaging ~19ms — **within the 200ms latency target**.

### 6.2 Double-Buffered Results

The AI Worker Manager maintains two result buffers:

```typescript
class AIWorkerManager {
  private currentResult: AIFrameResult | null = null;
  private pendingResult: AIFrameResult | null = null;

  // Called when worker posts a result
  private onWorkerResult(result: AIFrameResult): void {
    this.pendingResult = result;
  }

  // Called at the START of each render frame
  swapBuffers(): void {
    if (this.pendingResult) {
      this.currentResult = this.pendingResult;
      this.pendingResult = null;
    }
  }

  // Read by game systems during the frame
  get pose(): PoseData | null { return this.currentResult?.pose ?? null; }
  get hands(): HandData | null { return this.currentResult?.hands ?? null; }
  get depth(): DepthMapData | null { return this.currentResult?.depth ?? null; }
}
```

This ensures the game always reads a **consistent** snapshot — never a mix of pose from frame N and hands from frame N-1.

### 6.3 Adaptive Model Scheduling

Not every model needs to run every frame. The `InferenceScheduler` decides what to run based on game state and hardware capability:

```typescript
class InferenceScheduler {
  private modelStates = {
    pose: { enabled: true, priority: 1, lastRun: 0, intervalMs: 0 },
    hands: { enabled: false, priority: 2, lastRun: 0, intervalMs: 40 },
    depth: { enabled: false, priority: 3, lastRun: 0, intervalMs: 66 },
  };

  // Called before each inference cycle
  getNextBatch(timestamp: number): ModelType[] {
    const batch: ModelType[] = [];

    // Always run pose (highest priority, game depends on it)
    if (this.modelStates.pose.enabled) batch.push('pose');

    // Run hands every ~40ms (25 FPS) — enough for grab/throw
    if (this.modelStates.hands.enabled &&
        timestamp - this.modelStates.hands.lastRun >= this.modelStates.hands.intervalMs) {
      batch.push('hands');
    }

    // Run depth every ~66ms (15 FPS) — occlusion doesn't need high FPS
    if (this.modelStates.depth.enabled &&
        timestamp - this.modelStates.depth.lastRun >= this.modelStates.depth.intervalMs) {
      batch.push('depth');
    }

    return batch;
  }
}
```

**Budget-aware scheduling**: If the previous inference cycle exceeded the target time budget (e.g., >45ms), the scheduler automatically drops the lowest-priority model for the next cycle.

### 6.4 Frame Staleness Handling

When the game reads AI results that are 1-2 frames old:

| System | Staleness Tolerance | Strategy |
|---|---|---|
| Pose tracking | High (33ms OK) | PoseSmoother already handles jitter; add temporal interpolation |
| Hand tracking | Medium (16ms OK) | Smooth hand velocity over 3 frames for stable throw trajectory |
| Depth occlusion | High (66ms OK) | Depth boundaries change slowly; 15 FPS depth is visually acceptable |
| Collision detection | Critical (0ms ideal) | Use **predicted** pose position: `predictedPos = lastPos + velocity × dt` |

**Pose prediction** for collision:

```typescript
function predictPosePosition(
  current: PoseData,
  previous: PoseData,
  dt: number
): PoseData {
  // Extrapolate each landmark based on frame-over-frame velocity
  const predicted = { ...current };
  for (const key of LANDMARK_KEYS) {
    const curr = current[key];
    const prev = previous[key];
    predicted[key] = {
      x: curr.x + (curr.x - prev.x) * dt * 0.5,
      y: curr.y + (curr.y - prev.y) * dt * 0.5,
      z: curr.z,
      visibility: curr.visibility
    };
  }
  return predicted;
}
```

---

## 7. Revised Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN THREAD                                  │
│                                                                      │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐              │
│  │ Video    │───>│ createImage  │───>│ AIWorkerManager│              │
│  │ <video>  │    │ Bitmap()     │    │ (postMessage)  │              │
│  └──────────┘    └──────────────┘    └───────┬───────┘              │
│                                              │                      │
│  ┌───────────────────────────────────────────┼──────────────┐       │
│  │              GAME LOOP (60 FPS)           │              │       │
│  │                                           │              │       │
│  │  1. swapBuffers() <──────────────────────┘              │       │
│  │  2. game.update(dt)                                      │       │
│  │     ├─ updateObstacles(dt)                               │       │
│  │     ├─ updateThrownOrbs(dt)    ← physics                 │       │
│  │     └─ difficulty.update(dt)                             │       │
│  │  3. collisionSystem.evaluate(pose, hands, obstacles)     │       │
│  │     ├─ body vs red walls (AABB)                          │       │
│  │     ├─ body vs lasers (squat check)                      │       │
│  │     ├─ hands vs orbs (pinch grab)                        │       │
│  │     ├─ thrown orbs vs walls (AABB)                       │       │
│  │     └─ tangible vs obstacles (proximity)                 │       │
│  │  4. sceneManager.render()                                │       │
│  │     ├─ renderVideoBackground()                           │       │
│  │     ├─ renderObstacles()                                 │       │
│  │     ├─ renderThrownOrbs()                                │       │
│  │     ├─ renderTangibleWeapon()                            │       │
│  │     └─ depthOcclusionPass.composite(depthMap)            │       │
│  │  5. domUI.update()                                       │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    postMessage(ImageBitmap)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        AI WORKER THREAD                              │
│                                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │ Pose       │  │ Hand         │  │ Depth        │                 │
│  │ Landmarker │  │ Landmarker   │  │ Estimator    │                 │
│  │ ~8ms       │  │ ~12ms        │  │ ~18ms        │                 │
│  └────────────┘  └──────────────┘  └──────────────┘                 │
│                                                                      │
│  InferenceScheduler decides which models to run each cycle           │
│  Budget: < 45ms total per cycle                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Browser Compatibility & Feature Detection

Not all browsers support the APIs needed for V2. The game must degrade gracefully:

| Feature | Required API | Chrome | Firefox | Safari | Fallback |
|---|---|---|---|---|---|
| Web Workers | `Worker` | 4+ | 3.5+ | 4+ | None (hard requirement) |
| OffscreenCanvas | `OffscreenCanvas` | 69+ | 105+ | 16.4+ | `createImageBitmap()` |
| GPU Delegate (WebGL in Worker) | `OffscreenCanvas` + WebGL | 69+ | 105+ | ❌ | CPU delegate (slower) |
| Depth Estimation | WebGPU or WebGL2 | 113+ | ❌ | ❌ | Disable depth, no occlusion |
| Hand Landmarker | WASM (always works) | ✅ | ✅ | ✅ | None needed |

**Feature detection at startup**:

```typescript
const capabilities = {
  hasOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
  hasWebGL2InWorker: false,  // Test by creating OffscreenCanvas + getContext('webgl2')
  hasWebGPU: typeof navigator.gpu !== 'undefined',
  maxGPUContexts: 8,  // Estimated, varies by device
};
```

---

## 9. Memory Management

Running three MediaPipe models simultaneously is memory-intensive:

| Component | Estimated Memory |
|---|---|
| Pose Landmarker (lite) | ~30 MB (model + WASM heap) |
| Hand Landmarker (lite) | ~25 MB |
| Depth Estimator (small) | ~40 MB |
| Three.js scene + textures | ~50 MB |
| Video frame buffers (2× ImageBitmap) | ~14 MB |
| Depth map texture | ~0.5 MB |
| **Total** | **~160 MB** |

**Mitigation strategies**:
- Load models lazily: only load Hand Landmarker when hand interaction phase begins
- Unload models when transitioning to game states that don't need them
- Use `lite` model variants wherever available
- Pool and reuse `ImageBitmap` objects (create 2, alternate)
- Monitor `performance.memory.usedJSHeapSize` and disable low-priority models if heap exceeds 256 MB

---

## 10. Revised Performance Targets

| Metric | V1 Target | V2 Target | Strategy |
|---|---|---|---|
| Render FPS | ≥ 30 | **≥ 60** | Off-main-thread inference frees main thread |
| AI Inference FPS | N/A (main thread) | **≥ 25** | Single worker, sequential models, budget scheduling |
| End-to-end latency | < 200ms | **< 150ms** | Prediction + double-buffering reduces effective latency |
| Depth Occlusion FPS | N/A | **≥ 15** | Depth model runs at reduced frequency |
| Memory | N/A | **< 256 MB** | Lazy model loading, bitmap pooling |

---

## 11. Key Technical Decisions Summary

| Decision | Choice | Rationale |
|---|---|---|
| Worker architecture | Single AI Worker | Simpler coordination, shared WASM runtime, one GPU context |
| Frame transfer | `ImageBitmap` + Transferable | Zero-copy transfer, broad browser support |
| Hand physics | Custom vector math | Matter.js is 200KB+ overkill for ~5 thrown objects |
| Depth model | Depth Anything V2 (small) | Best accuracy/size ratio, MediaPipe compatible |
| Occlusion method | Post-process depth comparison | Non-invasive — doesn't require per-material shader changes |
| Object tracking | HSV color blob detection | ~50 lines of code, 2-5ms, no model needed |
| Scheduling | Priority-based with budget cap | Graceful degradation under load |
| Pose prediction | Linear extrapolation | Simple, effective for <33ms prediction window |
