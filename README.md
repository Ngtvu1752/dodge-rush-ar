# Dodge Rush AR

Dodge Rush AR is a browser-based webcam AR motion game for laptops.  
The player stands in front of a webcam and uses body movements as the main input method.

The game uses real-time pose tracking to detect body gestures such as dodging left, dodging right, squatting, and touching targets with hands. These gestures are used to avoid obstacles, collect targets, and score points.

## Project Goal

The goal of this project is to build a complete motion-based AR arcade game prototype that demonstrates:

- webcam-based AR interaction
- real-time human pose tracking
- gesture recognition
- body-based gameplay input
- collision detection between body landmarks and virtual objects
- arcade-style score, combo, health, and difficulty systems
- gameplay evaluation for accuracy, latency, and fairness

This project is intended as a personal portfolio project and a technical prototype inspired by motion-based arcade games such as Active Arcade, Kinect-style games, and Just Dance-style interaction.

## Core Concept

The player sees their mirrored webcam feed on the screen.  
Virtual obstacles and targets are rendered on top of the webcam image.

The player must physically move their body to interact with the game:

| Real Movement | Game Action |
|---|---|
| Move body left | Dodge left |
| Move body right | Dodge right |
| Squat | Avoid high laser |
| Move hand into target | Touch blue orb |
| Spread both arms | Activate shield, optional feature |

## Core Gameplay Loop

```text
Start
→ Camera permission
→ Calibration
→ Countdown
→ Obstacles appear
→ Player reacts with body movement
→ Game evaluates success or failure
→ Score, combo, and health update
→ Difficulty increases over time
→ Game over or timer ends
→ Result screen
→ Restart
```

## Main Features

### Required MVP Features
- Webcam feed displayed on screen
- Mirrored camera view
- Real-time pose tracking
- Pose landmark visualization in debug mode
- Player calibration
- Gesture detection:
    - dodge left
    - dodge right
    - squat
    - hand touch
- Obstacle spawning
- Collision and action evaluation
- Score system
- Combo system
- Health system
- Timer
- Countdown
- Game over screen
- Result screen
- Restart flow

### Optional Features
- Shield gesture
- Yellow Gate obstacle
- Coin Trail obstacle
- Sound effects
- Visual effects
- Local best score
- Exportable gameplay logs
- Evaluation summary

## Tech Stack
- Vite
- TypeScript
- HTML Canvas 2D
- MediaPipe Pose Landmarker
- Browser Webcam API
- LocalStorage for best score
- Optional Web Audio API for simple sound effects

### Recommended Development Stack
```bash
npm create vite@latest dodge-rush-ar -- --template vanilla-ts
cd dodge-rush-ar
npm install
npm install @mediapipe/tasks-vision
npm run dev
```

## How to Run
```bash
npm install
npm run dev
```
Then open the local development URL shown in the terminal.
The app requires webcam permission.

## How to Play
1. Open the game in a browser.
2. Allow webcam access.
3. Stand around 1.5 to 2.5 meters away from the laptop.
4. Make sure your upper body, hips, and hands are visible.
5. Complete calibration by standing still.
6. React to obstacles:
    - Move left or right to dodge red walls.
    - Squat to avoid high lasers.
    - Touch blue orbs with either hand.
7. Survive until the timer ends or until health reaches zero.

## Core Obstacles
| Obstacle | Required Player Action | Result |
|---|---|---|
| Red Wall Left | Dodge right | Avoid damage |
| Red Wall Right | Dodge left | Avoid damage |
| High Laser | Squat | Avoid damage |
| Blue Orb | Touch with hand | Gain score |
| Yellow Gate | Spread both arms | Optional feature |
| Coin Trail | Move body into coins | Optional feature |

## Game Rules

### Health
The player starts with 3 health points.
The player loses 1 health point when failing to avoid:
- Red Wall
- High Laser
- Yellow Gate, if implemented

When health reaches 0, the game ends.

### Score
Suggested scoring:
| Action | Points |
|---|---|
| Correct dodge | +100 |
| Correct squat | +100 |
| Blue Orb touch | +150 |
| Shield gate success | +200 |
| Coin collected | +25 |

### Combo
Each successful action increases combo by 1.
The combo resets when:
- the player fails an obstacle
- the player misses an important action
- the player is hit

Suggested multiplier:
- Combo 0-9: x1.0
- Combo 10-19: x1.5
- Combo 20+: x2.0

## Development Phases
1. Project setup
2. Webcam rendering
3. Pose tracking
4. Debug skeleton
5. Pose smoothing
6. Calibration
7. Gesture detection
8. Game state machine
9. Score, combo, and health
10. Obstacle system
11. Collision system
12. UI overlay
13. Difficulty scaling
14. Evaluation logger
15. Polish and documentation

See `docs/ROADMAP.md` for the full development checklist.

## Documentation
- `docs/GAME_DESIGN.md` — game design and mechanics
- `docs/TECHNICAL_PLAN.md` — technical architecture and modules
- `docs/ROADMAP.md` — step-by-step implementation roadmap
- `docs/AI_AGENT_INSTRUCTIONS.md` — rules for Claude Code or AI coding agents
- `docs/EVALUATION.md` — gameplay evaluation plan

## Evaluation
This project does not benchmark MediaPipe Pose Landmarker as a machine learning research model.
Instead, the evaluation focuses on whether the pose tracking and gesture recognition are reliable enough for fair gameplay.
Key evaluation metrics:
- gesture accuracy
- false positive rate
- false negative rate
- render FPS
- pose detection FPS
- perceived input latency
- player-perceived fairness

See `docs/EVALUATION.md` for details.

## Known Limitations
- Webcam tracking quality depends on lighting and camera position.
- Laptop webcams may not capture the full body if the player is too close.
- Squat and hand detection may require threshold tuning.
- The game is designed for one player only.
- The game is not a full 3D AR experience; it is a webcam-based AR overlay game.

## Future Improvements
- Add Yellow Gate and shield gesture
- Add Coin Trail
- Add sound effects and particles
- Add local leaderboard
- Add multiple difficulty levels
- Add tutorial mode
- Add multiplayer mode
- Add better pose confidence handling
- Add replay or session analytics

## Portfolio Summary
Dodge Rush AR demonstrates a complete real-time body interaction game pipeline:
Webcam input → Pose tracking → Pose smoothing → Calibration → Gesture detection → Collision evaluation → Game state update → Rendering and feedback.

The project focuses on creating a playable and fair motion-based game experience using only a laptop webcam.