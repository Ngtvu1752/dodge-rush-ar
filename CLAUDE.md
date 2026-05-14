# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

Build a complete webcam-based AR motion game prototype. The player stands in front of a laptop webcam and uses real body movements — dodging left/right, squatting, touching targets with hands — to avoid obstacles and score points. The game uses MediaPipe Pose Landmarker for real-time pose tracking and renders obstacles on top of the mirrored webcam feed using HTML Canvas 2D.

This is a portfolio project demonstrating: webcam AR interaction, real-time pose tracking, gesture recognition, collision detection between body landmarks and virtual objects, and arcade-style game systems.

## Commands

```bash
npm run dev       # Start Vite dev server (requires webcam permission in browser)
npm run build     # Type-check with tsc then bundle with Vite
npm run preview   # Preview production build
```

No test framework is installed yet. Test gameplay manually in the browser after each phase. Unit testing (Vitest) may be added in a later phase for pure logic modules (`math.ts`, `PoseSmoother`, `CollisionSystem`).

## Mandatory Pre-Implementation Step

**Always read the relevant docs before implementing any feature.** Do not guess architecture, data types, or game rules from memory.

- `docs/GAME_DESIGN.md` — game mechanics, obstacles, scoring, health, combo, fairness rules, difficulty phases
- `docs/TECHNICAL_PLAN.md` — module responsibilities, data types, system requirements, performance targets
- `docs/ROADMAP.md` — strict build order (20 phases), what to implement in each phase
- `docs/AI_AGENT_INSTRUCTIONS.md` — folder structure, development rules, reporting format
- `docs/EVALUATION.md` — gameplay reliability metrics and test procedures

## Mandatory Implementation Order

Follow `docs/ROADMAP.md` phase by phase. Do not skip phases or implement features out of order.

| Phase | Milestone | Key Deliverables |
|---|---|---|
| 0 | Project Setup | Vite + TS scaffold, `@mediapipe/tasks-vision`, folder structure, full-screen canvas, hidden video element |
| 1 | Webcam System | `CameraManager.ts` — webcam permission, 1280x720 preferred, mirrored feed on canvas |
| 2 | Renderer | `Renderer.ts` — canvas context, drawing helpers, `requestAnimationFrame` main loop |
| 3 | Pose Tracking | `PoseTracker.ts` — load MediaPipe Pose Landmarker, video mode, internal `PoseData` format |
| 4 | Debug Skeleton | `DebugSkeleton.ts` — visualize landmarks, debug toggle with 'D' key |
| 5 | Pose Smoothing | `PoseSmoother.ts` — lerp (factor 0.35), grace period 150-300ms for lost pose |
| 6 | Calibration | `Calibration.ts` — 2s neutral pose sample, derive dodge/squat thresholds |
| 7 | Gesture Detection | `GestureDetector.ts` — dodge, squat, hand active; hysteresis 100-150ms hold |
| 8 | Game State Machine | `GameManager.ts`, `GameState.ts` — state flow, keyboard shortcuts (Space, C, D) |
| 9 | Core Stats | `ScoreManager.ts` — score, combo, multiplier, health (3 HP), timer (60s) |
| 10 | Obstacle Base | `Obstacle.ts` interface — spawner, lifecycle (spawn → move → cleanup) |
| 11 | Red Wall | `RedWall.ts` — left/right dodge obstacles with labels and hit zone timing |
| 12 | Red Wall Collision | `CollisionSystem.ts` — evaluate dodge success/failure |
| 13 | High Laser | `HighLaser.ts` — squat obstacle, success/failure evaluation |
| 14 | Blue Orb | `BlueOrb.ts` — hand target, touch detection |
| 15 | Difficulty Scaling | `DifficultyManager.ts` — speed/spawn rate scaling over time |
| 16 | UI Overlay | `UIOverlay.ts` — score, health, timer, instructions, result screen |
| 17 | Evaluation Logger | `logger.ts` — event recording, result screen summary |
| 18 | Feedback & Audio | Visual/audio feedback for success/failure, score popups, combo highlights |
| 19 | Local Best Score | LocalStorage save/load |
| 20 | Final Documentation | Polish README, portfolio assets |

## Required Folder Structure

```
src/
├─ main.ts                    # Entry point — keep minimal
├─ style.css
├─ config/
│  └─ gameConfig.ts           # All game constants and tuning values
├─ camera/
│  └─ CameraManager.ts        # Webcam access and stream management
├─ pose/
│  ├─ PoseTracker.ts          # MediaPipe Pose Landmarker integration
│  ├─ PoseTypes.ts            # Point, PoseData, CalibrationData types
│  └─ PoseSmoother.ts         # Landmark jitter reduction
├─ input/
│  ├─ Calibration.ts          # Neutral pose capture
│  └─ GestureDetector.ts      # Pose → PlayerAction conversion
├─ game/
│  ├─ GameManager.ts          # State transitions and main loop orchestration
│  ├─ GameState.ts            # GameState enum
│  ├─ ScoreManager.ts         # Score, combo, multiplier, health, timer
│  └─ DifficultyManager.ts    # Speed and spawn rate scaling
├─ entities/
│  ├─ Obstacle.ts             # Base obstacle interface
│  ├─ RedWall.ts              # Dodge obstacle (left/right)
│  ├─ HighLaser.ts            # Squat obstacle
│  └─ BlueOrb.ts              # Hand touch target
├─ collision/
│  ├─ BodyHitbox.ts           # Pose landmarks → collision shapes
│  └─ CollisionSystem.ts      # Hit evaluation
├─ render/
│  ├─ Renderer.ts             # Canvas drawing, resize handling
│  ├─ DebugSkeleton.ts        # Landmark visualization (toggle 'D')
│  └─ UIOverlay.ts            # HUD: score, health, timer, feedback
└─ utils/
   ├─ math.ts                 # Math helpers
   └─ logger.ts               # Evaluation event logging
```

Create directories and files only as needed for the current phase. Do not scaffold the entire structure upfront.

## Strict Coding Constraints

1. **Incremental only.** Implement one phase at a time. Do not jump ahead.
2. **App must run after every phase.** `npm run dev` must work and show visible progress after each milestone. Never leave the app in a broken state.
3. **Keep main.ts small.** All game logic lives in dedicated modules. main.ts only wires things together.
4. **TypeScript strict.** Use explicit interfaces for all shared data types. No `any`.
5. **No frameworks.** Vite + TypeScript + Canvas 2D only. No React, no game engines, no UI libraries unless explicitly requested.
6. **No backend.** Everything runs in the browser.
7. **Mirrored webcam.** Canvas must horizontally flip the video feed.
8. **Calibration is required.** The game cannot start without capturing the player's neutral standing pose first.
9. **Forgiving gameplay.** Grace windows 150-250ms. Gesture hold 100-150ms. Never punish the player when pose tracking confidence is low.
10. **No frame-perfect timing.** Give the player warning before obstacles reach the hit zone.

## Forbidden Features (MVP)

Do not implement any of these until all 20 roadmap phases are complete and the core game is fully functional:

- Multiplayer
- Online leaderboard
- Full 3D rendering
- Mobile/phone support
- Rhythm/music system
- Kick detection
- Dance mode
- Account system
- Cloud saving
- React or any UI framework
- Game engine (Phaser, Three.js, etc.)
- Webpack or any bundler other than Vite

## Game State Machine

All gameplay flows through this state machine. Do not create alternate flows.

```
Loading → CameraPermission → Calibration → Ready → Countdown → Playing → GameOver → Result
```

## Key Technical Parameters

These values come from `docs/TECHNICAL_PLAN.md` and `docs/GAME_DESIGN.md`. Use them as-is; do not invent new values.

| Parameter | Value | Source |
|---|---|---|
| Smoothing factor | 0.35 | TECHNICAL_PLAN.md |
| Pose loss grace period | 150-300ms | TECHNICAL_PLAN.md |
| Dodge threshold | `shoulderWidth * 0.45` | TECHNICAL_PLAN.md |
| Squat threshold | `torsoHeight * 0.25` | TECHNICAL_PLAN.md |
| Gesture hold duration | 100-150ms | TECHNICAL_PLAN.md |
| Obstacle grace window | 150-250ms | GAME_DESIGN.md |
| Starting health | 3 HP | GAME_DESIGN.md |
| Session length | 60 seconds | GAME_DESIGN.md |
| Easy phase | 0-20s, slow speed, 1600ms interval | GAME_DESIGN.md |
| Medium phase | 20-40s, medium speed, 1200ms interval | GAME_DESIGN.md |
| Hard phase | 40-60s, high speed, 900ms interval | GAME_DESIGN.md |
| Combo 0-9 | x1.0 multiplier | GAME_DESIGN.md |
| Combo 10-19 | x1.5 multiplier | GAME_DESIGN.md |
| Combo 20+ | x2.0 multiplier | GAME_DESIGN.md |
| Render FPS target | >= 30 | TECHNICAL_PLAN.md |
| Pose FPS target | >= 20 | TECHNICAL_PLAN.md |
| Latency target | < 200ms | TECHNICAL_PLAN.md |

## Required Reporting After Each Phase

After completing each roadmap phase, report:

1. **Files created/modified** — list every file touched.
2. **How to test manually** — specific steps to verify the phase works in the browser.
3. **Known limitations** — what does not work yet or has rough edges.
4. **Next recommended step** — which phase comes next and what it requires.

## Source-of-Truth References

Do not duplicate these values in code comments or commit messages. Read the source doc when you need details.

| Topic | Source |
|---|---|
| Scoring rules, combo multipliers, health, timer | `docs/GAME_DESIGN.md` |
| Obstacle types, required actions, failure results | `docs/GAME_DESIGN.md` |
| Fairness rules (grace windows, hitbox forgiveness, spawn spacing) | `docs/GAME_DESIGN.md` |
| Difficulty phases (speed, spawn intervals) | `docs/GAME_DESIGN.md` |
| Data types (Point, PoseData, CalibrationData, PlayerAction, BodyHitbox) | `docs/TECHNICAL_PLAN.md` |
| Module responsibilities and interfaces | `docs/TECHNICAL_PLAN.md` |
| Evaluation metrics and test procedures | `docs/EVALUATION.md` |
