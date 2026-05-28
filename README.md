# Dodge Rush AR

Dodge Rush AR is a browser-based webcam AR arcade prototype built with TypeScript, Three.js, and MediaPipe Tasks Vision. The game uses mirrored camera input, body movement, and optional hand interaction to let the player dodge, squat, touch, grab, and throw against virtual obstacles.

## Current V2 Scope

The active V2 scope is complete through:
- Stage A: worker-based AI inference foundation
- Stage B: depth pipeline, occlusion, and z-axis obstacle movement
- Stage C: hand interaction, pinch/grab/throw blue orbs
- Stage D: runtime performance profiles, visual polish, and capability fallback/documentation

Removed from scope:
- tangible object tracking
- weapon / shield prop systems
- Stage D archived roadmap ideas (`V2-11..V2-13`)

## Core Gameplay

Body gameplay:
- Move left or right to dodge red walls
- Squat to avoid high lasers
- Avoid meteors as they approach on the z-axis

Orb gameplay:
- Blue orbs can still score by touch when hands are unavailable
- When hands are available, blue orbs become grab-first
- Pinch near a blue orb to grab it
- Release with speed to throw at RedWall or Meteor targets
- Blue orb throws do not affect HighLaser

## Main V2 Features

- Worker-based pose / hands / depth inference
- Budget-aware inference scheduler with runtime profiles
- Mirrored webcam scene with Three.js overlays
- Depth map debug view and occlusion rendering
- Z-axis obstacle projection for RedWall, HighLaser, BlueOrb, and Meteor
- Hand landmarks, pinch detection, grab/release state machine, and throw velocity tracking
- Hybrid blue orb interaction:
  - hands available -> grab-first
  - hands unavailable -> touch fallback
- Thrown-orb collision against:
  - RedWallLeft
  - RedWallRight
  - RedWallCenter
  - Meteor
- Projectile-specific VFX, popups, and HUD/debug feedback
- Capability detection with balanced/fallback runtime profiles

## Controls

Gameplay / debug controls:
- `Space`: start / continue / restart depending on game state
- `C`: calibration / recalibration
- `D`: debug overlay
- `F`: depth debug overlay
- `P`: toggle runtime profile (`balanced` / `fallback`)

Model toggles:
- `1`: pose on/off
- `2`: hands on/off
- `3`: depth on/off

Spawn toggles:
- `4`: RedWallLeft
- `5`: RedWallRight
- `6`: RedWallCenter
- `7`: HighLaser
- `8`: BlueOrb
- `9`: Meteor

Dev helpers during gameplay:
- `O`: spawn a debug BlueOrb
- `S`: success popup test
- `T`: hit popup test

## Sound Effects (SFX)

The game uses Web Audio API to generate procedural sound effects — no external audio files required. All sounds are synthesized in real-time using oscillators and gain envelopes.

### Collision SFX
| Event | Sound |
|---|---|
| RedWall / Meteor dodged | Bright rising chime |
| HighLaser squatted | Quick positive blip |
| BlueOrb touched | Sparkle with harmonic |
| BlueOrb missed | Descending wobble |
| Player hit by obstacle | Impact thud |
| Thrown orb bullseye | Triumphant rising tone |
| Wall destroyed by projectile | Shatter/crash |
| Meteor destroyed by projectile | Explosive boom |

### Hand Interaction SFX
| Event | Sound |
|---|---|
| Grab BlueOrb | Quick pop |
| Throw BlueOrb | Whoosh |

### Game Flow SFX
| Event | Sound |
|---|---|
| Countdown tick (3, 2, 1) | Tick |
| GO! | Exciting tone |
| Game over | Descending doom |
| Combo multiplier up (x1.5 / x2.0) | Level-up chime |
| Combo break | Harsh reset |
| Difficulty change (Easy → Medium → Hard) | Escalation |

Toggle mute with `M` key.

## Runtime Profiles and Fallback

The game currently exposes two runtime profiles:
- `balanced`: primary desktop target
- `fallback`: reduced optional load, depth deprioritized or disabled when needed

Capability detection reports whether the browser/runtime supports:
- hands
- depth
- occlusion
- the recommended runtime profile

Fallback rules:
- if hands are unavailable, V1-style blue orb touch remains valid
- if depth / occlusion are unavailable, gameplay still runs without those visual layers
- if runtime profile falls back, optional depth features yield before pose + hands interaction

## Recommended Browser Target

Primary target:
- Chrome / Edge on desktop with webcam permission enabled

Partial-support paths:
- Firefox
- Safari 17+

See [docs/BROWSER_SUPPORT.md](docs/BROWSER_SUPPORT.md) for the current matrix.

## How to Run

```bash
npm install
npm run dev
```

The app requires webcam permission.

## Manual Test References

- [docs/ROADMAP_V2.md](docs/ROADMAP_V2.md)
- [docs/BROWSER_SUPPORT.md](docs/BROWSER_SUPPORT.md)
- [docs/EVALUATION.md](docs/EVALUATION.md)

## Tech Stack

- Vite
- TypeScript
- Three.js
- MediaPipe Tasks Vision
- HTML Canvas / DOM UI overlays
- Browser Webcam API
- GSAP

## Known Limitations

- Webcam quality varies heavily by laptop camera, browser, and lighting
- Advanced webcam tuning constraints are browser/device dependent and may be ignored
- Firefox / Safari support for depth and occlusion should be treated as verify-on-device, not assumed full parity
- Hand tracking quality still depends on framing, lighting, and motion blur
- This remains a webcam AR overlay game, not world-tracked AR
