# Technical Plan

## Project Name
Dodge Rush AR

## Technical Goal
Build a browser-based webcam AR motion game using real-time pose tracking.

The system should take webcam input, estimate human pose landmarks, convert landmarks into player actions, and use those actions to drive arcade gameplay.

## Tech Stack
Required stack:
- Vite
- TypeScript
- HTML Canvas 2D
- MediaPipe Pose Landmarker
- Browser Webcam API

Optional stack:
- Web Audio API for simple sounds
- LocalStorage for best score
- JSON or CSV export for evaluation logs

## Architecture Overview
Webcam Input → Pose Detection → Pose Smoothing → Calibration → Gesture Detection → Body Hitbox Generation → Game State Manager → Obstacle System → Collision / Action Evaluation → Score / Combo / Health Update → Rendering → UI Feedback

### Automated Testing (Future)
No test framework is installed in the MVP. Test gameplay manually in the browser after each phase.
When unit testing is added later (Vitest recommended), prioritize pure logic modules:
- `utils/math.ts`
- `pose/PoseSmoother.ts`
- `collision/CollisionSystem.ts`

### Main Modules
| Module | Responsibility |
|---|---|
| CameraManager | Request webcam access and manage video stream |
| Renderer | Draw webcam background, game objects, debug UI, and overlay |
| PoseTracker | Run MediaPipe Pose Landmarker |
| PoseSmoother | Reduce landmark jitter |
| Calibration | Capture neutral standing pose |
| GestureDetector | Convert pose data into player actions |
| GameManager | Manage state transitions and main gameplay loop |
| ScoreManager | Track score, combo, multiplier, health, timer |
| DifficultyManager | Scale speed and spawn rate over time |
| Obstacle | Base entity interface |
| RedWall | Dodge obstacle |
| HighLaser | Squat obstacle |
| BlueOrb | Hand touch target |
| BodyHitbox | Convert pose landmarks into collision shapes |
| CollisionSystem | Evaluate obstacle success/failure |
| UIOverlay | Render score, health, timer, feedback |
| Logger | Record events for evaluation |

## Proposed Folder Structure
```text
src/
├─ main.ts
├─ style.css
├─ config/
│  └─ gameConfig.ts
├─ camera/
│  └─ CameraManager.ts
├─ pose/
│  ├─ PoseTracker.ts
│  ├─ PoseTypes.ts
│  └─ PoseSmoother.ts
├─ input/
│  ├─ Calibration.ts
│  └─ GestureDetector.ts
├─ game/
│  ├─ GameManager.ts
│  ├─ GameState.ts
│  ├─ ScoreManager.ts
│  └─ DifficultyManager.ts
├─ entities/
│  ├─ Obstacle.ts
│  ├─ RedWall.ts
│  ├─ HighLaser.ts
│  └─ BlueOrb.ts
├─ collision/
│  ├─ BodyHitbox.ts
│  └─ CollisionSystem.ts
├─ render/
│  ├─ Renderer.ts
│  ├─ DebugSkeleton.ts
│  └─ UIOverlay.ts
└─ utils/
   ├─ math.ts
   └─ logger.ts
```

## Data Types

### Point
```typescript
export type Point = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};
```
Coordinates should be normalized or converted consistently to canvas coordinates.

### PoseData
```typescript
export type PoseData = {
  nose: Point;
  leftShoulder: Point;
  rightShoulder: Point;
  leftElbow: Point;
  rightElbow: Point;
  leftWrist: Point;
  rightWrist: Point;
  leftHip: Point;
  rightHip: Point;
  leftKnee: Point;
  rightKnee: Point;
  leftAnkle: Point;
  rightAnkle: Point;
  detected: boolean;
  timestamp: number;
};
```

### CalibrationData
```typescript
export type CalibrationData = {
  neutralCenterX: number;
  standingHipY: number;
  standingShoulderY: number;
  shoulderWidth: number;
  torsoHeight: number;
  dodgeThreshold: number;
  squatThreshold: number;
};
```

### PlayerAction
```typescript
export type PlayerAction = {
  dodgeLeft: boolean;
  dodgeRight: boolean;
  squat: boolean;
  leftHandActive: boolean;
  rightHandActive: boolean;
  shield: boolean;
};
```

### Rect / Circle
```typescript
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Circle = {
  x: number;
  y: number;
  radius: number;
};
```

### BodyHitbox
```typescript
export type BodyHitbox = {
  torso: Rect;
  fullBody: Rect;
  leftHand: Circle;
  rightHand: Circle;
  head?: Circle;
};
```

## Camera System
Requirements for `CameraManager`:
- request webcam permission
- prefer 1280x720 resolution if possible
- fallback gracefully if preferred resolution is unavailable
- attach stream to a hidden video element
- expose the video element to the renderer and pose tracker
- handle camera permission errors

### Camera Rendering
The webcam feed should be mirrored horizontally. Canvas rendering should apply horizontal mirroring when drawing the video.

## Pose Tracking System
Requirements for `PoseTracker`:
- load MediaPipe Pose Landmarker
- run in video mode
- detect pose landmarks from the webcam video
- return `PoseData` in the project’s internal format
- handle cases where no pose is detected

## Pose Smoothing
Pose landmarks may jitter. `PoseSmoother` should reduce jitter using linear interpolation:
`smoothed = previous + (current - previous) * smoothingFactor`
Recommended `smoothingFactor = 0.35`.
Grace period for lost pose: **150ms to 300ms**.

## Calibration System
Calibration captures the neutral standing pose.
- Show instruction: "Stand in frame"
- Confirm shoulders and hips are visible
- Collect pose samples for 2 seconds
- Average body measurements
- Save `CalibrationData`
- Enter "Ready" state

Measurements: neutral center X, standing hip Y, standing shoulder Y, shoulder width, torso height.
Suggested Thresholds:
- `dodgeThreshold = shoulderWidth * 0.45`
- `squatThreshold = torsoHeight * 0.25`

## Gesture Detection
`GestureDetector` takes `PoseData + CalibrationData` and outputs `PlayerAction`.

- **Dodge Detection**: Use hip/shoulder center offset from neutral center.
- **Squat Detection**: Use current hip Y compared to standing hip Y.
- **Hand Touch Detection**: Hand circle overlaps target circle.
- **Shield Detection (Optional)**: Wrists far from shoulders.

**Hysteresis and Hold Time**: 
- Use minimum hold duration: **100ms to 150ms**.
- Use gesture state memory.
- Grace window for obstacles: **150ms to 250ms**.

## Game State Machine
Required states:
```typescript
export enum GameState {
  Loading = "Loading",
  CameraPermission = "CameraPermission",
  Calibration = "Calibration",
  Ready = "Ready",
  Countdown = "Countdown",
  Playing = "Playing",
  GameOver = "GameOver",
  Result = "Result",
}
```

## Obstacle System

### Base Interface
```typescript
export interface Obstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  active: boolean;
  resolved: boolean;
  update(dt: number): void;
  render(renderer: Renderer): void;
}
```

### Collision and Evaluation
- **Red Wall**: success if `dodgeRight`/`dodgeLeft`.
- **High Laser**: success if `squat`.
- **Blue Orb**: success if hand overlap.

## Score Manager
Tracks score, combo, multiplier, health (default 3), timer (60s).

## Difficulty Manager
Scales speed and spawn interval based on time:
- 0-20s: Low Speed / 1600ms interval
- 20-40s: Medium Speed / 1200ms interval
- 40-60s: High Speed / 900ms interval

## Renderer
Owns canvas context, handles resize, draws mirrored video, obstacles, debug skeleton (toggle with 'D'), and UI.

## Logger
Records `GameLogEvent` (timestamp, fps, poseDetected, gestures, result, etc.) for evaluation.

## Performance Targets
- Render FPS >= 30
- Pose FPS >= 20
- Latency < 200ms