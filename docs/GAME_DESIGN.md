# Game Design Document

## Game Title
Dodge Rush AR

Alternative title:
AR Reflex Runner

## One-Sentence Pitch
Dodge Rush AR is a webcam-based arcade motion game where the player uses real body movements to dodge obstacles, squat under lasers, and touch targets on screen.

## High-Level Concept
The player stands in front of a laptop webcam.  
The game displays the mirrored webcam feed as the background and overlays virtual arcade obstacles on top of it.

Instead of using keyboard, mouse, or controller input, the player controls the game through physical movement.

The game detects body pose landmarks and converts them into gameplay actions such as:
- dodge left
- dodge right
- squat
- touch target with hand
- spread arms for shield, optional

## Design Goals
The game should be:
- easy to understand within 10 seconds
- playable with only a laptop webcam
- safe to play in a small room
- responsive and forgiving
- visually clear
- suitable for a portfolio demo
- technically impressive but not over-scoped

## Target Platform
Primary platform:
- Laptop browser with webcam

Recommended browser:
- Chrome
- Edge

The game should run locally using Vite.

## Target Player
The target player is a casual player who wants a short physical arcade experience.
The game should not require:
- game controller
- VR headset
- depth camera
- phone AR
- large open room
- advanced physical movement

## Player Setup
Recommended setup:
| Requirement | Recommendation |
|---|---|
| Distance from laptop | 1.5 to 2.5 meters |
| Camera position | Around chest or eye level |
| Lighting | Bright indoor lighting |
| Space | Enough room to move left/right and squat |
| Clothing | Preferably visible against background |

## Core Gameplay Loop
Start game → Player grants camera permission → Player stands in frame → Calibration starts → Game counts down → Obstacle appears → Player reacts → Game checks success/failure → Score, combo, and health update → Difficulty increases → Game ends → Result screen appears → Player restarts

## Core Player Actions
| Action | Physical Movement | Detection Source | Gameplay Purpose |
|---|---|---|---|
| Dodge Left | Move body center left | Hip or shoulder center | Avoid right-side obstacle |
| Dodge Right | Move body center right | Hip or shoulder center | Avoid left-side obstacle |
| Squat | Lower body/hips | Hip Y position | Avoid high laser |
| Hand Touch | Move wrist into target | Left/right wrist | Hit or collect target |
| Shield | Spread both arms | Both wrists and shoulders | Pass gate, optional |

### Required MVP Actions
The first playable version must support:
- Dodge left
- Dodge right
- Squat
- Hand touch

Shield is optional and should only be implemented after the core game is stable.

## Obstacles

### 1. Red Wall Left
A red obstacle appears on the left side of the play area.
Required action: **Dodge right**.
The player succeeds if they actively dodge right OR are already standing safely on the right side when the wall reaches the hit zone.
If the player is not on the correct side in time, they lose health.

### 2. Red Wall Right
A red obstacle appears on the right side of the play area.
Required action: **Dodge left**.
The player succeeds if they actively dodge left OR are already standing safely on the left side when the wall reaches the hit zone.
If the player is not on the correct side in time, they lose health.

### 3. High Laser
A horizontal laser appears around the upper body or head area.
Required action: **Squat**.
If the player does not squat in time, they lose health.

### 4. Blue Orb
A blue circular target appears on screen.
Required action: **Touch with either hand**.
If the player touches it, they gain score and combo.
If the player misses it, combo may reset, but health should not be reduced in the MVP.

### 5. Yellow Gate, optional
A gate appears and requires the player to spread both arms.
Required action: **Shield**.
This is optional and should be implemented only after the core MVP is stable.

### 6. Coin Trail, optional
A trail of coins appears and the player collects coins by moving their body or hands into them.
This is optional and should be implemented only after the core MVP is stable.

### Obstacle Summary
| Obstacle | Required Action | Failure Result | MVP |
|---|---|---|---|
| Red Wall Left | Dodge right | -1 health | Yes |
| Red Wall Right | Dodge left | -1 health | Yes |
| High Laser | Squat | -1 health | Yes |
| Blue Orb | Hand touch | Combo reset | Yes |
| Yellow Gate | Shield | -1 health | Optional |
| Coin Trail | Body movement | No penalty | Optional |

## Game Session Length
Recommended MVP session: **60 seconds**.
Alternative modes for future versions:
- 30-second quick mode
- 90-second challenge mode
- endless mode

## Health System
The player starts with: **3 HP**.
Health decreases when the player fails dangerous obstacles:
- Red Wall
- High Laser
- Yellow Gate, optional

The game ends when: **Health = 0** or **Timer = 0**.

## Score System
Suggested base score:
| Event | Points |
|---|---|
| Successful dodge | +100 |
| Successful squat | +100 |
| Blue Orb hit | +150 |
| Shield success | +200 |
| Coin collected | +25 |

## Combo System
Each successful action increases combo by 1.
Combo resets when:
- the player is hit
- the player fails a required movement
- the player misses an important target

Suggested multiplier:
| Combo | Multiplier |
|---|---|
| 0-9 | x1.0 |
| 10-19 | x1.5 |
| 20+ | x2.0 |

Score formula: `final_points = base_points * multiplier`

## Difficulty Scaling
The game should become harder over time.
Suggested difficulty phases:
| Time | Difficulty | Behavior |
|---|---|---|
| 0-20 seconds | Easy | Slow obstacles, single actions |
| 20-40 seconds | Medium | Faster obstacles, shorter spawn interval |
| 40-60 seconds | Hard | Faster obstacles, more frequent targets |

Difficulty can increase through:
- faster obstacle speed
- shorter spawn interval
- more varied obstacle types
- more demanding target positions

Do not create unfair patterns. Avoid:
- requiring squat and dodge at the exact same time in MVP
- spawning obstacles too close together
- spawning hand targets outside realistic reach
- punishing the player when tracking confidence is too low

## Fairness Rules
The player should feel that the game is fair.
The game should:
- provide warning before obstacles reach the hit zone
- use forgiving hitboxes
- evaluate gestures over a short time window
- avoid frame-perfect timing
- avoid punishing the player when pose tracking is lost
- show clear feedback after every action

Recommended input grace window: **150ms to 250ms**.

## Visual Style
Suggested style:
- bright arcade colors
- transparent obstacles over webcam
- large readable text
- clear warning labels
- simple particle effects
- high contrast UI

Required UI elements:
- score
- combo
- health
- timer
- current state message
- feedback text
- calibration instructions
- result screen

## Audio Style
Optional MVP audio:
- success beep
- fail beep
- countdown sound
- game over sound

If no audio assets exist, use Web Audio API to generate simple tones.

## Game States
The game should use a state machine.
Required states:
- Loading
- CameraPermission
- Calibration
- Ready
- Countdown
- Playing
- GameOver
- Result

State flow:
Loading → CameraPermission → Calibration → Ready → Countdown → Playing → GameOver → Result

## MVP Definition
The MVP is complete when:
- webcam opens
- webcam feed is mirrored
- pose landmarks are detected
- calibration works
- dodge left/right works
- squat works
- hand touch works
- red walls work
- high laser works
- blue orb works
- score/combo/health work
- countdown works
- game over and result screen work
- the player can restart the game

## Non-Goals for MVP
Do not implement in MVP:
- multiplayer
- online leaderboard
- full 3D AR
- advanced character animation
- mobile support
- rhythm music system
- kick detection
- full dance mode
- account system
- cloud saving

## Future Features
- Yellow Gate and shield gesture
- Coin Trail
- local best score
- better visual effects
- better sound feedback
- multiple difficulty modes
- analytics screen
- replay summary
- two-player mode