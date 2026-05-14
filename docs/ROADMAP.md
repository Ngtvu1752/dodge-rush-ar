# Roadmap

This roadmap defines the development order for Dodge Rush AR. Implementation should be incremental.

## Phase 0: Project Setup
- Create Vite + TypeScript project.
- Install `@mediapipe/tasks-vision`.
- Create folder structure.
- Basic `index.html`, `main.ts`, `style.css`.
- Full-screen canvas and hidden video element.

## Phase 1: Webcam System
- Create `CameraManager.ts`.
- Request webcam permission (prefer 1280x720).
- Mirror webcam feed on canvas.

## Phase 2: Renderer
- Create `Renderer.ts` to own canvas context and drawing helpers.
- Implement main loop with `requestAnimationFrame`.

## Phase 3: Pose Tracking
- Create `PoseTracker.ts`.
- Load MediaPipe Pose Landmarker.
- Run in video mode and convert to internal `PoseData`.

## Phase 4: Debug Skeleton
- Create `DebugSkeleton.ts` to visualize landmarks.
- Support debug toggle.

## Phase 5: Pose Smoothing
- Create `PoseSmoother.ts` using linear interpolation.
- Handle temporary pose loss.

## Phase 6: Calibration
- Create `Calibration.ts`.
- Collect 2s samples for neutral pose.
- Calculate body thresholds.

## Phase 7: Gesture Detection
- Create `GestureDetector.ts`.
- Detect: dodge, squat, hand active.
- Add hysteresis/hold duration.

## Phase 8: Game State Machine
- Create `GameManager.ts` and `GameState.ts`.
- Implement state flow: Loading → CameraPermission → Calibration → Ready → Countdown → Playing → GameOver → Result.
- Keyboard shortcuts: Space (Start), C (Calibrate), D (Debug).

## Phase 9: Core Stats
- Create `ScoreManager.ts`.
- Track score, combo, health, timer.
- Implement Game Over triggers.

## Phase 10: Obstacle Base System
- Create `Obstacle.ts` interface.
- Implement spawner and lifecycle (spawn → move → cleanup).

## Phase 11: Red Wall
- Create `RedWall.ts` (Left/Right).
- Add labels and hit zone timing.

## Phase 12: Collision for Red Wall
- Create `CollisionSystem.ts`.
- Evaluate dodge action success/failure.

## Phase 13: High Laser
- Create `HighLaser.ts`.
- Evaluate squat action success/failure.

## Phase 14: Blue Orb
- Create `BlueOrb.ts`.
- Implement hand target detection.

## Phase 15: Difficulty Scaling
- Create `DifficultyManager.ts`.
- Scale speed/spawn rate over time.

## Phase 16: UI Overlay
- Create `UIOverlay.ts`.
- Render stats, instructions, and result screen.

## Phase 17: Evaluation Logger
- Create `logger.ts`.
- Record events and show summary on result screen.

## Phase 18: Feedback and Audio
- Add visual/audio feedback for success/failure.
- Score popups and combo highlights.

## Phase 19: Local Best Score
- Save/Load best score using LocalStorage.

## Phase 20: Final Documentation
- Polish README.md and add portfolio assets.