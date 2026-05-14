# AI Agent Instructions

This file defines how AI coding agents should work on Dodge Rush AR.

## Project Summary
Browser-based webcam AR motion game using pose tracking for body movement input.

## Tech Stack
- Vite, TypeScript, HTML Canvas 2D, MediaPipe Pose Landmarker.
- No Unity, no React (unless requested), no backend.

## Development Rules
- **Incremental Implementation**: Build milestone by milestone as defined in `ROADMAP.md`.
- **Modular Code**: Keep `main.ts` small.
- **Type Safety**: Use TypeScript interfaces for shared data.
- **Source of Truth**: Refer to `GAME_DESIGN.md`, `TECHNICAL_PLAN.md`, and `ROADMAP.md`.

## Folder Structure
```text
src/
├─ main.ts
├─ config/gameConfig.ts
├─ camera/CameraManager.ts
├─ pose/ (PoseTracker, PoseTypes, PoseSmoother)
├─ input/ (Calibration, GestureDetector)
├─ game/ (GameManager, GameState, ScoreManager, DifficultyManager)
├─ entities/ (Obstacles)
├─ collision/ (BodyHitbox, CollisionSystem)
├─ render/ (Renderer, DebugSkeleton, UIOverlay)
└─ utils/ (math, logger)
```

## Technical Constraints
- **Mirroring**: Camera feed must be mirrored.
- **Smoothing**: Apply interpolation to pose data.
- **Calibration**: Required before gameplay.
- **Forgiving Collision**: Use hit zones and grace windows.
- **Debug Mode**: Toggle with 'D'.

## Milestone Reporting
After each step, report:
1. Files created/modified.
2. How to test manually.
3. Known limitations.
4. Next recommended step.