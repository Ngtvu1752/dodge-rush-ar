# V2 Roadmap: Deep Interaction & Spatial Awareness

## Dodge Rush AR — Implementation Roadmap

This roadmap defines the strict, sequential build order for V2. Each phase builds on the previous one. **Do not skip phases or implement features out of order.**

V2 is organized into **4 active stages** spanning **13 phases**. Each phase has clear deliverables, acceptance criteria, and manual test procedures.

---

## Prerequisites

Before starting V2, ensure:

- V1 MVP is complete and functional (all 20 V1 phases done)
- `npm run build` succeeds with zero errors
- Game runs at 60 FPS in Chrome on target hardware
- All V1 obstacle types (RedWall, HighLaser, BlueOrb) work correctly
- Debug skeleton (D key) works

---

## STAGE A: Multi-Threaded Foundation

**Goal**: Migrate all AI inference off the main thread so the render loop maintains 60 FPS regardless of model complexity.

---

### Phase V2-01: Web Worker Infrastructure

**Objective**: Establish the Web Worker communication framework and transfer the existing Pose Landmarker to a worker thread.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/workers/AITypes.ts` | Create | Shared TypeScript interfaces for worker communication |
| `src/workers/ai.worker.ts` | Create | Worker entry point — receives frames, runs pose inference, returns results |
| `src/workers/AIWorkerManager.ts` | Create | Main-thread manager — creates worker, sends frames, receives results |
| `src/workers/InferenceScheduler.ts` | Create | Decides which models to run per inference cycle |
| `src/workers/models/PoseModel.ts` | Create | Pose Landmarker wrapper (moved from PoseTracker.ts logic) |
| `src/pose/PoseTracker.ts` | Modify | Becomes a thin proxy that reads from AIWorkerManager instead of running inference directly |
| `src/main.ts` | Modify | Wire AIWorkerManager into the game loop; send video frames, read pose results |
| `vite.config.ts` | Modify | Add worker build configuration |

**Architecture**:

```
Main Thread                          AI Worker Thread
┌─────────────┐                     ┌─────────────────┐
│ CameraMgr   │──createImageBitmap──>│ ai.worker.ts    │
│             │                      │                 │
│ gameLoop()  │                      │ PoseModel.ts    │
│ ├─ send frame──postMessage(bitmap)─>│ ├─ detect()   │
│ ├─ read pose <──postMessage(result)─│ └─ return     │
│ ├─ update   │                      └─────────────────┘
│ ├─ render   │
│ └─ 60 FPS!  │
└─────────────┘
```

**Acceptance Criteria**:
- [ ] Pose inference runs in Web Worker (verify via Chrome DevTools → Performance tab: no `detectForVideo` on main thread)
- [ ] Main thread maintains 60 FPS with pose detection active
- [ ] Pose data format (`PoseData`) is identical to V1 — no downstream code changes needed
- [ ] Debug skeleton still works (D key) — reading from worker results
- [ ] Calibration flow works — calibration reads from worker results
- [ ] All V1 obstacle types still function correctly
- [ ] Worker initialization shows a loading indicator (model download takes 2-5s)

**Manual Test**:
1. `npm run dev` — game loads and shows webcam
2. Press D — skeleton overlay appears with <1 frame latency
3. Press Space — game starts, obstacles spawn
4. Play for 30 seconds — FPS counter stays at 60
5. Open DevTools → Performance → Record 5s of gameplay → verify no MediaPipe calls on main thread
6. Dodge left/right — RedWall detection works
7. Squat — HighLaser detection works
8. Touch BlueOrb — detection works

**Known Limitations**:
- First inference frame has ~2-5s cold start while model loads in worker
- If the browser doesn't support `OffscreenCanvas`, falls back to `createImageBitmap` (slightly higher latency)

---

### Phase V2-02: Adaptive Inference Scheduling

**Objective**: Implement the budget-aware inference scheduler that can dynamically enable/disable models based on hardware capability and game state.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/workers/InferenceScheduler.ts` | Modify | Implement priority queue, budget tracking, adaptive throttling |
| `src/workers/AIWorkerManager.ts` | Modify | Add `setModels()` command to dynamically toggle models |
| `src/config/gameConfig.ts` | Modify | Add V2 AI scheduling constants (target inference time, model priorities) |

**Key Logic**:

```typescript
// InferenceScheduler decisions per cycle:
// 1. Always run Pose (priority 1, game depends on it)
// 2. Run Hands if enabled AND enough time budget remaining
// 3. Run Depth if enabled AND enough time budget remaining
// 4. If last cycle exceeded budget → skip lowest priority model
```

**Acceptance Criteria**:
- [ ] Scheduler logs which models ran each cycle (debug overlay)
- [ ] If total inference time > 45ms, scheduler drops lowest-priority model next cycle
- [ ] `setModels({ pose: true, hands: false, depth: false })` can be called at runtime
- [ ] FPS stays stable even when scheduler skips a model

**Manual Test**:
1. Enable debug overlay — watch scheduler decisions in real-time
2. Artificially slow down inference (add 20ms sleep) — verify scheduler adapts
3. Toggle models on/off via keyboard shortcuts — verify smooth transitions

---

### Phase V2-03: Depth Map Pipeline (No Occlusion Yet)

**Objective**: Load the Depth Estimator model in the worker, produce depth maps, and visualize them on the main thread — but don't apply occlusion yet.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/workers/models/DepthModel.ts` | Create | Depth estimation model wrapper |
| `src/workers/ai.worker.ts` | Modify | Add depth inference to pipeline |
| `src/workers/AITypes.ts` | Modify | Add `DepthMapData` type (Float32Array + dimensions) |
| `src/workers/AIWorkerManager.ts` | Modify | Handle depth results, manage depth texture |
| `src/render/DebugDepthMap.ts` | Create | Debug visualization — renders depth map as grayscale overlay (toggle with 'F' key) |
| `src/config/gameConfig.ts` | Modify | Add depth model config constants |

**Depth Map Data Format**:

```typescript
interface DepthMapData {
  buffer: Float32Array;    // 128×128 depth values, 0.0=near, 1.0=far
  width: number;           // 128
  height: number;          // 128
  timestamp: number;       // For staleness tracking
}
```

**Acceptance Criteria**:
- [ ] Depth model loads successfully in the worker
- [ ] Depth map updates at ~15 FPS (every ~66ms)
- [ ] Debug overlay (F key) shows grayscale depth visualization — player body is bright (near), background is dark (far)
- [ ] Depth map quality is sufficient to distinguish player from background at arm's length
- [ ] Scheduling keeps pose at full speed while depth runs at reduced frequency
- [ ] Memory usage stays under 256 MB (check via `performance.memory`)

**Manual Test**:
1. Press F — depth visualization appears
2. Stand at arm's length from camera — body appears bright, background dark
3. Move closer/farther — depth values change
4. Raise arm in front of body — arm appears brighter (closer) than torso
5. Check FPS — should stay above 50
6. Play for 2 minutes — no memory leaks (check heap size in Task Manager)

**Known Limitations**:
- Depth map is low-res (128×128) — edges are blocky
- Depth estimation may fail in low light — returns null gracefully
- Depth model adds ~18ms to inference cycle — scheduler may skip it under load

---

## STAGE B: Depth Occlusion Rendering

**Goal**: Use depth maps to correctly occlude 3D obstacles when they pass behind the player's body.

---

### Phase V2-04: Depth Occlusion Shader

**Objective**: Implement the post-processing depth occlusion compositing pass in Three.js.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/render/DepthOcclusionPass.ts` | Create | Full-screen shader pass that composites depth map with scene |
| `src/render/SceneManager.ts` | Modify | Add EffectComposer with depth occlusion pass to render pipeline |
| `src/shaders/depth-occlusion.glsl` | Create | GLSL fragment shader for depth comparison |
| `src/config/gameConfig.ts` | Modify | Add occlusion constants (threshold, blur radius, soft edge) |

**Shader Logic**:

```glsl
// For each pixel:
float aiDepth = texture2D(tDepthMap, vUv).r;     // Player depth (0=near, 1=far)
float objDepth = linearizeDepth(texture2D(tSceneDepth, vUv).r);  // Object depth

// Soft occlusion: blend over a threshold range
float occlusion = smoothstep(aiDepth - 0.05, aiDepth + 0.05, objDepth);
gl_FragColor = mix(sceneColor, vec4(0.0), occlusion);  // 0.0 = transparent (show video)
```

**Acceptance Criteria**:
- [ ] When a Red Wall passes behind the player's torso, the wall is hidden behind the body
- [ ] When a Red Wall is in front of the player, it renders normally on top
- [ ] Occlusion boundary is smooth (no hard pixelated edges)
- [ ] Depth map mirroring matches webcam mirroring — left/right is consistent
- [ ] No visible flickering at occlusion boundaries
- [ ] Disabling depth (via debug toggle) reverts to V1 behavior (obstacles always on top)
- [ ] FPS stays above 45 with occlusion enabled

**Manual Test**:
1. Start game, wait for a Red Wall to approach
2. Stand so the wall passes through your torso area
3. Verify: wall disappears behind your body, reappears on the other side
4. Repeat with HighLaser — verify occlusion at waist level
5. Press debug toggle to disable occlusion — verify V1 behavior returns
6. Check FPS — should be 45-60 with occlusion on

**Known Limitations**:
- Occlusion is based on relative depth, not absolute — may not align perfectly at body edges
- Low-res depth map (128×128) causes blocky boundaries — mitigated by Gaussian blur on depth texture
- Very fast movements may cause 1-frame occlusion lag (depth updates at 15 FPS)

---

### Phase V2-05: Depth Map Temporal Smoothing

**Objective**: Smooth depth map transitions between frames to prevent occlusion flickering.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/render/DepthMapProcessor.ts` | Create | Temporal interpolation + Gaussian blur for depth maps |
| `src/render/DepthOcclusionPass.ts` | Modify | Use processed depth map instead of raw |
| `src/workers/AITypes.ts` | Modify | Add `depthHistory` ring buffer type |

**Key Logic**:
- Maintain last 2 depth maps
- Interpolate between them based on main thread time vs. depth timestamps
- Apply 3×3 Gaussian blur to smooth blocky edges
- Clamp depth values to prevent extreme outliers

**Acceptance Criteria**:
- [ ] No visible flickering at occlusion boundaries during normal gameplay
- [ ] Occlusion boundary moves smoothly even when depth map updates at 15 FPS
- [ ] No performance regression (blur runs in shader, negligible cost)

---

### Phase V2-06: Z-Axis Obstacle Movement

**Objective**: Modify obstacles to move in 3D space (from far Z toward camera) instead of just moving top-to-bottom in 2D.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/entities/Obstacle.ts` | Modify | Add `z` position to obstacle interface (projected from a shared world-Z depth model) |
| `src/entities/RedWall.ts` | Modify | Spawn far in world-Z, move toward camera, and project into shared screen space |
| `src/entities/HighLaser.ts` | Modify | Same z-axis movement pattern |
| `src/entities/BlueOrb.ts` | Modify | Use the same projection model as RedWall/HighLaser so collision and render stay aligned |
| `src/render/entities/RedWallVisual.ts` | Modify | Position in projected screen-space and scale by perspective without double-scaling coordinates |
| `src/render/entities/HighLaserVisual.ts` | Modify | Same perspective scaling |
| `src/render/entities/BlueOrbVisual.ts` | Modify | Same perspective scaling |
| `src/collision/CollisionSystem.ts` | Modify | Collision evaluation accounts for z-depth proximity |

**3D Movement Math**:

```typescript
// Perspective scaling (orthographic camera pseudo-depth)
const scale = 1.0 / (1.0 + obstacle.z * 2.0);  // z=0 → scale 1.0, z=0.8 → scale 0.38
visual.scale.set(scale, scale, scale);

// Position: combine 2D screen position with z-depth
visual.position.set(
  obstacle.x * scale,
  obstacle.y * scale,
  -obstacle.z * 1000  // Push into screen
);
```

**Acceptance Criteria**:
- [ ] Obstacles appear small in the distance and grow as they approach
- [ ] Obstacles that pass "behind" the player are correctly occluded (uses Phase V2-04 shader)
- [ ] Collision detection still works — hit zone is when obstacle reaches z ≈ 0
- [ ] Perspective scaling feels natural — not too fast or too slow
- [ ] All V1 obstacle types work with z-axis movement

**Manual Test**:
1. Start game — watch Red Wall spawn small in the distance
2. Wall grows as it approaches — feels like it's flying toward you
3. When wall passes through your body area, verify occlusion works
4. Dodge left/right — collision still detects correctly
5. Repeat for HighLaser and BlueOrb

---

## STAGE C: Hand Interaction & Physics

**Goal**: Add fine-grained hand tracking with pinch/grab/throw mechanics.

---

### Phase V2-07: Hand Landmarker Integration

**Objective**: Load Hand Landmarker in the AI Worker, produce hand landmark data, and visualize it on the main thread.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/workers/models/HandModel.ts` | Create | Hand Landmarker wrapper (21 landmarks × 2 hands) |
| `src/workers/ai.worker.ts` | Modify | Add hand inference to pipeline |
| `src/workers/AITypes.ts` | Modify | Add `HandData` type (left/right hand, 21 landmarks each) |
| `src/workers/AIWorkerManager.ts` | Modify | Handle hand results |
| `src/pose/PoseTypes.ts` | Modify | Add hand landmark types |
| `src/render/DebugSkeleton.ts` | Modify | Draw hand landmarks when debug mode is active |
| `src/input/HandTracker.ts` | Create | Processes raw hand landmarks into actionable per-hand state (pinch, grab, velocity) in parallel with body gestures |

**HandData Type**:

```typescript
interface HandLandmark {
  x: number; y: number; z: number;
  visibility: number;
}

interface SingleHand {
  landmarks: HandLandmark[];   // 21 points
  handedness: 'Left' | 'Right';
  confidence: number;
}

interface HandData {
  left: SingleHand | null;
  right: SingleHand | null;
  timestamp: number;
}
```

**Acceptance Criteria**:
- [ ] Hand landmarks appear in debug overlay (D key) — 21 points per hand
- [ ] Both hands tracked simultaneously
- [ ] Hand tracking doesn't reduce pose tracking quality
- [ ] FPS stays above 50 with pose + hands running
- [ ] Hand landmarks are correctly mirrored (left hand appears on left side of screen)
- [ ] Missing hand data degrades gracefully to `null` without breaking pose gameplay

**Manual Test**:
1. Enable debug (D key) — hand landmarks appear as colored dots
2. Open and close hand — all 21 points track correctly
3. Move hands rapidly — tracking stays stable
4. Check FPS — should be 50+ with both models running

---

### Phase V2-08: Pinch Detection & Gesture System

**Objective**: Implement pinch detection, grab state machine, and hand velocity tracking.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/input/HandTracker.ts` | Modify | Add pinch detection, grab state machine, cooldown, and velocity history |
| `src/input/GestureDetector.ts` | Modify | Narrow to body-only action output; hand gestures remain owned by `HandTracker` |
| `src/config/gameConfig.ts` | Modify | Add hand tracking constants (pinch threshold, velocity window, grab sensitivity) |

**Architecture Note**:

Body gestures and hand gestures must run in parallel. `GestureDetector` remains responsible for body posture/movement, while `HandTracker` owns pinch/grab/release state. Do not use a single exclusive gesture state machine for both systems.

`PlayerAction` should remain body-only in Stage C (`dodgeLeft`, `dodgeRight`, `squat`). Do not keep pose-derived hand booleans such as `leftHandActive`, `rightHandActive`, or `shield` in the gameplay input contract once hand tracking is enabled.

**Pinch State Machine**:

```
Open ──(thumb-index distance < 0.05)──> Pinching ──(held 100ms)──> Grabbed
  ^                                        │                         │
  │                                        └──(distance > 0.08)──┘  │
  └──────────────────────────(distance > 0.08)──────────────────────┘
```

**Velocity Tracking**:

```typescript
// Ring buffer of last 5 wrist positions
const velocityHistory: { pos: Point; time: number }[] = [];

// On each frame, push current wrist position
// To calculate throw velocity:
const dt = velocityHistory[4].time - velocityHistory[0].time;
const vx = (velocityHistory[4].pos.x - velocityHistory[0].pos.x) / dt;
const vy = (velocityHistory[4].pos.y - velocityHistory[0].pos.y) / dt;
```

**Acceptance Criteria**:
- [ ] Pinch gesture detected when thumb tip touches index tip
- [ ] Grab state persists while fingers remain pinched
- [ ] Release detected when fingers separate
- [ ] Hand velocity tracked over last 5 frames
- [ ] Simultaneous body + hand gestures work (e.g., dodge left while pinching with right hand)
- [ ] Gesture hold duration (100ms) prevents false triggers
- [ ] Short hand tracking dropouts do not instantly cancel an active grab
- [ ] Debug/HUD hand status comes from `HandTracker`, not pose wrist heuristics

**Manual Test**:
1. Pinch thumb and index — debug overlay shows "PINCH" state
2. Hold pinch — state changes to "GRABBED" after 100ms
3. Release — state returns to "OPEN"
4. Move hand rapidly while pinched — velocity vector displayed
5. Dodge left while pinching — both gestures detected simultaneously

---

### Phase V2-09: Grab & Throw Blue Orbs

**Objective**: Allow players to grab Blue Orbs with a pinch gesture and throw them at obstacles.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/entities/ThrownOrb.ts` | Create | Thrown projectile entity with physics (position, velocity, gravity, lifetime) |
| `src/entities/BlueOrb.ts` | Modify | Add hybrid interaction state (`free/candidate/grabbed/thrown/consumed`) and follow a smoothed hand anchor when grabbed |

Stage C arbitration note: BlueOrb remains hybrid, but once hands are interaction-available the orb should follow a `grab-first` policy. Touch remains a fallback only when hands are unavailable, and a single orb must never resolve through both touch and throw paths.
| `src/collision/CollisionSystem.ts` | Modify | Add thrown-orb-vs-wall collision detection |
| `src/game/GameManager.ts` | Modify | Track thrown orbs, update physics, evaluate collisions |
| `src/render/entities/ThrownOrbVisual.ts` | Create | Three.js visual for thrown orb (glowing trail, spin animation) |
| `src/input/HandTracker.ts` | Modify | Detect grab/release events on BlueOrbs |

Implementation note: the current codebase already contains a partial grab/throw pipeline. `V2-09` should stabilize and align that pipeline rather than rebuild it from scratch.

**Grab-Throw Flow**:

```
1. BlueOrb spawns in scene (existing behavior)
2. Player moves hand near orb (within grab radius ≈ 80px)
3. Player pinches → orb enters GRABBED state
4. Orb follows a smoothed hand anchor on a shallow interaction plane
5. Player makes throwing motion (hand velocity > threshold)
6. Orb releases with throw velocity + slight upward arc
7. Thrown orb travels in parabolic path
8. If thrown orb hits a RedWall or Meteor → target destroyed, bonus points
9. If thrown orb misses → disappears after 3 seconds

`ThrownOrb vs HighLaser` is deferred to `V2-10` and should not be part of active `V2-09` gameplay acceptance.
```

**Acceptance Criteria**:
- [ ] Blue Orb can be grabbed by pinching near it
- [ ] Grabbed orb follows hand position smoothly
- [ ] Throwing motion (fast hand movement) releases orb with correct velocity
- [ ] Thrown orb follows parabolic trajectory (gentle gravity)
- [ ] Thrown orb hitting a RedWall destroys it with satisfying VFX
- [ ] Thrown orb missing disappears after timeout
- [ ] Score popup appears on successful hit (+200 bonus)
- [ ] Can still touch BlueOrbs normally (existing V1 behavior) as alternative
- [ ] If hand tracking is unavailable, BlueOrb touch still works as a graceful fallback

**Manual Test**:
1. Start game, wait for BlueOrb to spawn
2. Move hand near orb, pinch — orb attaches to hand
3. Flick hand in a direction — orb flies that way
4. Aim at an approaching RedWall — orb hits and destroys it
5. Verify particle burst and score popup on hit
6. Try grabbing from too far — should not grab (radius check)
7. Try throwing slowly — orb drops to floor (low velocity)

---

### Phase V2-10: Hand Interaction Polish

**Objective**: Polish the grab/throw mechanics with visual feedback, haptic-like cues, and edge case handling.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/render/entities/ThrownOrbVisual.ts` | Modify | Final polish for trail, spin readability, and impact response |
| `src/render/vfx/GrabIndicator.ts` | Modify | Tune affordance so near-orb grab intent is clearer |
| `src/entities/ThrownOrb.ts` | Modify | Clamp or expire trajectories cleanly at screen bounds |
| `src/input/HandTracker.ts` | Modify | Final debounce/cooldown tuning to avoid rapid re-grab |
| `src/render/entities/RedWallVisual.ts` | Modify | Add projectile-specific wall-break reaction distinct from ordinary dodge success |
| `src/main.ts` | Modify | Add final hand/throw HUD polish for testability |

**Acceptance Criteria**:
- [ ] Grab indicator appears when hand is within grab radius of an orb
- [ ] Thrown orb has a visible motion trail
- [ ] Thrown orb spins during flight
- [ ] Impact feedback on thrown hit is visually distinct and readable
- [ ] No rapid re-grab bugs after release
- [ ] Thrown orbs expire or clamp cleanly instead of drifting into unreadable space
- [ ] BlueOrb throws do not affect HighLaser; projectile targets remain RedWall and Meteor only
- [ ] HUD/debug clearly shows active grab, throw readiness, and throw outcome

---

## Stage D Decision

Stage D (tangible object tracking / weapon integration) is explicitly **removed from scope** for the current V2 release. The notes below are retained only as archived ideas and are not part of the active delivery plan.

---

### Phase V2-11: Color Object Tracking (Archived / Removed)

**Objective**: Implement real-time color-based object tracking using HSV blob detection.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/tracking/ColorTracker.ts` | Create | HSV color blob detection — finds object center and radius |
| `src/tracking/TangibleObject.ts` | Create | Tracked object state (position, size, velocity, confidence) |
| `src/workers/ai.worker.ts` | Modify | Add color tracking to inference pipeline (runs on main thread — too fast to need a worker) |
| `src/input/Calibration.ts` | Modify | Add "calibrate object color" step — sample HSV from center of frame |
| `src/render/DebugColorTrack.ts` | Create | Debug overlay showing tracked blob (green highlight) |

**Color Tracking Performance**:

The color tracker runs on the **main thread** (not the worker) because:
- It scans every 4th pixel → ~57,600 pixels for 720p → ~2-4ms
- It doesn't need GPU/WASM
- Avoids adding load to the already-busy AI worker

**Acceptance Criteria**:
- [ ] Player can calibrate a colored object by holding it up and pressing a key
- [ ] Tracked object appears as a highlighted blob in debug overlay
- [ ] Tracking updates at 60 FPS (main thread, no worker needed)
- [ ] Tracking is stable under normal lighting conditions
- [ ] Object position is correctly mirrored
- [ ] Tracking degrades gracefully in low light (confidence drops, no crash)

**Manual Test**:
1. Hold up a bright green object (ball, cloth, etc.)
2. Press calibration key — system samples the color
3. Debug overlay shows green highlight around the object
4. Move object around — tracking follows smoothly
5. Try with different colored objects — recalibrate each time
6. Test in low light — tracking gets noisier but doesn't crash

---

### Phase V2-12: Tangible Weapon Mapping (Archived / Removed)

**Objective**: Map the tracked physical object to a 3D weapon/shield that interacts with virtual obstacles.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/entities/TangibleWeapon.ts` | Create | Weapon state machine (idle, blocking, slashing) |
| `src/render/entities/TangibleWeaponVisual.ts` | Create | Three.js weapon visual (shield mesh for blocking, sword mesh for slashing) |
| `src/collision/CollisionSystem.ts` | Modify | Add weapon-vs-obstacle collision (proximity + velocity check) |
| `src/game/GameManager.ts` | Modify | Track weapon state, evaluate weapon interactions |
| `src/config/gameConfig.ts` | Modify | Add weapon constants (block radius, slash speed threshold, damage values) |

**Weapon Behaviors**:

```
Shield Mode (default):
  - Position tracked object in path of RedWall → wall deflected (blocked)
  - Requires: object position within wall bounds + object stationary (velocity < threshold)
  - Result: wall destroyed, player scores +150 points

Sword Mode (activated by fast horizontal movement):
  - Fast horizontal swipe → slash attack
  - Requires: object velocity > 500 px/s horizontally
  - Result: any obstacle in slash path destroyed, player scores +200 points
```

**Acceptance Criteria**:
- [ ] 3D shield/weapon visual appears at tracked object position
- [ ] Shield blocks RedWalls when positioned in their path
- [ ] Slash gesture (fast horizontal swipe) destroys obstacles
- [ ] Weapon visual scales based on object distance (larger when closer)
- [ ] Blocking and slashing have distinct VFX (deflection sparks vs slash trail)
- [ ] Weapon interaction doesn't break existing dodge/squat mechanics

**Manual Test**:
1. Calibrate colored object
2. Hold object still in path of approaching RedWall — wall deflects
3. Swipe object horizontally through a RedWall — wall slashed
4. Try blocking a HighLaser — should not work (shield doesn't block lasers)
5. Verify score popups for both block and slash actions
6. Play a full 60-second game mixing dodge + weapon mechanics

---

### Phase V2-13: Game Mode Integration (Archived / Removed)

**Objective**: Integrate all V2 mechanics into a cohesive game mode with proper state flow and difficulty scaling.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/game/GameManager.ts` | Modify | Add V2 game mode with all mechanics active |
| `src/game/DifficultyManager.ts` | Modify | Add difficulty parameters for hand interaction and weapon phases |
| `src/game/ScoreManager.ts` | Modify | Add scoring for throw hits (+200), weapon blocks (+150), weapon slashes (+250) |
| `src/render/ui/MenuScreen.ts` | Modify | Add V2 mode selection screen, tutorial prompts |
| `src/config/gameConfig.ts` | Modify | Final tuning of all V2 constants |

**Difficulty Scaling for V2**:

| Phase | Time | BlueOrb Spawn | Weapon Orbs | Throw Target |
|---|---|---|---|---|
| Tutorial | 0-15s | Every 5s | Color orb appears | RedWall only |
| Easy | 15-30s | Every 3s | 50% of orbs | RedWall + HighLaser |
| Medium | 30-45s | Every 2s | 75% of orbs | All obstacles |
| Hard | 45-60s | Every 1.5s | All orbs | All obstacles + faster |

**Acceptance Criteria**:
- [ ] Full 60-second game runs with all V2 mechanics active
- [ ] Tutorial prompts guide player through new mechanics in first 15 seconds
- [ ] Difficulty ramps smoothly — more orbs and faster obstacles over time
- [ ] Score leaderboard shows V1 and V2 scores separately
- [ ] All mechanics work together without conflicts
- [ ] Game remains playable if hand tracking or depth fails (graceful fallback to V1 mechanics)

---

## STAGE D: Polish & Optimization

**Goal**: Stabilize performance, tighten presentation quality, and formalize capability fallback/documentation for the shippable V2 scope.

---

### Phase V2-14: Runtime Performance Profiles

**Objective**: Add practical runtime profiling and capability-driven presets so V2 stays playable across stronger and weaker devices without inventing a second rendering architecture.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/utils/PerformanceMonitor.ts` | Create | Lightweight FPS / inference / frame-time monitor for debug and tuning |
| `src/utils/FeatureDetection.ts` | Create | Detect browser/runtime capabilities and choose safe defaults |
| `src/workers/InferenceScheduler.ts` | Modify | Add runtime profiles and explicit depth-yields-first behavior |
| `src/workers/AIWorkerManager.ts` | Modify | Surface capability/profile state needed by debug/HUD |
| `src/main.ts` | Modify | Apply selected profile, expose debug status, and keep fallbacks visible |
| `src/render/SceneManager.ts` | Modify | Gate optional depth/occlusion quality features based on capability/profile |

**Implementation Notes**:
- Prefer `balanced` as the default profile on supported desktop browsers.
- Do not overcommit to automatic low/medium/high heuristics based only on `navigator.gpu`; capability fallback should be conservative and debuggable.
- When under pressure, degrade in this order:
  1. reduce/disable depth extras
  2. slow optional depth cadence
  3. preserve `pose + hands` interaction path
- Performance work in this phase should improve observability first, then tuning.

**Acceptance Criteria**:
- [ ] Game exposes current runtime profile/capability state in debug mode
- [ ] Hands-enabled gameplay remains prioritized over depth when budget is tight
- [ ] A weaker capability path can disable depth/occlusion without breaking V1/V2 gameplay
- [ ] No new performance system depends on the removed Stage D tangible-object scope
- [ ] Monitoring/tuning tools are lightweight enough to leave enabled in dev builds

---

### Phase V2-15: Visual Polish & Readability

**Objective**: Polish the existing V2 visuals for readability and consistency rather than adding speculative new effects that increase maintenance cost.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `src/render/entities/ThrownOrbVisual.ts` | Modify | Final readability pass for trail, flight pulse, impact, and miss fade |
| `src/render/entities/RedWallVisual.ts` | Modify | Refine projectile-break and success/fail readability |
| `src/render/entities/MeteorVisual.ts` | Modify | Align projectile-hit readability with RedWall quality bar |
| `src/render/vfx/ParticleEmitter.ts` | Modify | Tune projectile / wall-break / fail presets for readability vs cost |
| `src/render/ui/HUDPanel.ts` | Modify | Consolidate hand tracking, grab, and throw feedback into a stable HUD layer |
| `src/main.ts` | Modify | Final popup/debug/HUD cleanup so success/fail causes are easy to read while playing |

**Implementation Notes**:
- Do not add a new depth-reactive particle system unless the simpler polish pass proves insufficient.
- Prioritize fast readability: the player should instantly distinguish `dodge success`, `player hit`, `orb touch`, `throw miss`, and `projectile destroy`.
- Visual polish must remain compatible with current Three.js + popup + particle architecture.

**Acceptance Criteria**:
- [ ] Thrown orb flight path is easy to track during real play
- [ ] Projectile-caused target destruction is visually distinct from ordinary dodge success
- [ ] HUD clearly communicates hand tracking, grab owner, and throw readiness without requiring debug mode
- [ ] VFX additions do not noticeably regress gameplay smoothness on the balanced profile
- [ ] RedWall / Meteor / BlueOrb feedback reads as one coherent visual language

---

### Phase V2-16: Capability Fallback, Testing & Documentation

**Objective**: Lock down what V2 actually supports, verify graceful fallback paths, and update project documentation to match the implemented release scope.

**Deliverables**:

| File | Action | Description |
|---|---|---|
| `docs/BROWSER_SUPPORT.md` | Create | Browser/runtime support matrix tied to actual fallback behavior |
| `docs/EVALUATION.md` | Modify | Add V2 evaluation checklist and manual regression cases |
| `README.md` | Modify | Update feature list, controls, limitations, and Stage C/Stage D scope |
| `src/utils/FeatureDetection.ts` | Modify | Surface final human-readable capability flags used by the app |
| `src/main.ts` | Modify | Show capability/fallback status clearly enough for QA/manual testing |

**Browser Test Matrix**:

| Browser | Pose | Hands | Depth | Occlusion | Orb Throw | Overall |
|---|---|---|---|---|---|---|
| Chrome / Edge (current) | Yes | Yes | Yes | Yes | Yes | Full target |
| Firefox (current) | Yes | Yes | Optional / verify | Optional / verify | Yes | Partial target |
| Safari 17+ | Yes | Yes | Optional / verify | Optional / verify | Yes | Partial target |

**Acceptance Criteria**:
- [ ] Capability detection reflects the actual active fallback path on the running device/browser
- [ ] Chrome/Edge path is documented as the primary target
- [ ] Partial-support browsers fail gracefully instead of silently degrading core gameplay
- [ ] Manual test checklist covers pose-only, pose+hands, pose+hands+depth, and no-hands fallback paths
- [ ] Docs no longer imply Stage D tangible-object features are still planned

---

## Phase Dependency Graph

Active dependency chain for the current V2 release ends at `V2-10` before moving directly to `V2-14..V2-16`. References to `V2-11..V2-13` remain archived only and are not part of the active delivery scope.

```
V2-01 (Worker Infra)
  -> V2-02 (Scheduling)
        -> V2-03 (Depth Pipeline)
              -> V2-04 (Occlusion Shader)
                    -> V2-05 (Depth Smoothing)
                          -> V2-06 (Z-Axis Movement)

V2-01 (Worker Infra)
  -> V2-07 (Hand Landmarker)
        -> V2-08 (Pinch Detection)
              -> V2-09 (Grab & Throw)
                    -> V2-10 (Hand Polish)

V2-06 (Z-Axis) + V2-10 (Hand Polish)
  -> V2-14 (Runtime Performance Profiles)
        -> V2-15 (Visual Polish & Readability)
              -> V2-16 (Capability Fallback, Testing & Docs)
```

---

## Estimated Timeline

Active delivery scope excludes `V2-11..V2-13`. The practical plan is `13 phases` across `4 active stages`.

| Stage | Phases | Effort | Dependencies |
|---|---|---|---|
| A: Multi-Threaded Foundation | V2-01 -> V2-03 | 3-4 weeks | None |
| B: Depth Occlusion | V2-04 -> V2-06 | 2-3 weeks | Stage A complete |
| C: Hand Interaction | V2-07 -> V2-10 | 3-4 weeks | V2-01 complete (can parallel with Stage B) |
| D: Polish & Optimization | V2-14 -> V2-16 | 2-3 weeks | Stages B + C complete |
| **Total** | **13 phases** | **10-14 weeks** | |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| MediaPipe Worker + OffscreenCanvas fails in Safari | Medium | High | Fallback to `createImageBitmap`; accept lower FPS |
| Depth model too slow on mid-range hardware | High | Medium | Make depth optional; scheduler auto-disables or deprioritizes under budget |
| Hand tracking jitter causes false grabs | Medium | Medium | Keep hysteresis, hold duration, cooldown, and responsive-but-bounded smoothing |
| Memory pressure from 3 models + Three.js | High | Medium | Monitor frame/inference cost, keep optional effects lightweight, unload or disable nonessential extras |
| Browser capability mismatch around depth/occlusion | Medium | High | Detect capabilities at runtime and make the fallback path visible to QA/users |

---

## V2 New Dependencies

| Package | Size | Purpose | Phase |
|---|---|---|---|
| *(none)* | — | All V2 features use existing `@mediapipe/tasks-vision` + vanilla JS | — |

V2 intentionally avoids new npm dependencies. MediaPipe's Hand Landmarker and depth estimation are already available in `@mediapipe/tasks-vision` v0.10.35, and the remaining V2 runtime/gameplay systems stay in vanilla TypeScript.



