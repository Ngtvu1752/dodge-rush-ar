# Browser Support

## Purpose

This document describes the currently intended V2 browser/runtime support for Dodge Rush AR after the active V2 scope (`V2-01..V2-10`, `V2-14..V2-16`).

Primary target:
- desktop Chrome / Edge

Partial-support browsers:
- Firefox
- Safari 17+

## Current Matrix

| Browser | Pose | Hands | Depth | Occlusion | Orb Throw | Runtime Profile | Notes |
|---|---|---|---|---|---|---|---|
| Chrome (current desktop) | Yes | Yes | Yes | Yes | Yes | Balanced target | Primary development and QA target |
| Edge (current desktop) | Yes | Yes | Yes | Yes | Yes | Balanced target | Expected near-Chrome behavior |
| Firefox (current desktop) | Yes | Yes | Verify on device | Verify on device | Yes | Often fallback | Depth/occlusion path should be treated as optional |
| Safari 17+ | Yes | Yes | Verify on device | Verify on device | Yes | Often fallback | MediaPipe / worker / canvas combinations should be validated per device |

## Capability Rules

The app detects runtime capabilities and derives a recommended runtime profile.

Capability flags surfaced by the app:
- browser name
- hands supported
- depth supported
- occlusion supported
- recommended runtime profile (`balanced` or `fallback`)
- fallback reason(s)

Meaning:
- `hands supported`: worker + image bitmap path is available for hand tracking
- `depth supported`: worker + image bitmap + offscreen canvas path is available for depth estimation
- `occlusion supported`: depth path plus WebGL2-level rendering support is available

## Fallback Behavior

If capability support is partial or weak:
- pose remains the core gameplay path
- hands may remain available even when depth/occlusion are unavailable
- depth may be disabled or deprioritized before pose + hands
- runtime profile may switch to `fallback`
- blue orb interaction degrades to touch fallback when hands are unavailable

If occlusion is unavailable:
- gameplay still works
- 3D obstacles remain visible without body-depth compositing

If hands are unavailable:
- body dodge / squat gameplay remains playable
- blue orb touch fallback remains available

## QA Expectations

For Chrome / Edge:
- treat `balanced` as the expected target
- verify pose + hands + optional depth path
- verify projectile interactions and HUD/debug state

For Firefox / Safari:
- verify that the game does not crash
- verify pose gameplay first
- verify whether hands load
- treat depth/occlusion as optional and document the observed fallback path

## Notes

This matrix is intentionally conservative. Browser support should follow observed behavior in the current build, not assumptions based only on API existence.
