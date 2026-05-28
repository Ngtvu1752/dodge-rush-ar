# Evaluation and Manual QA

## Purpose

This document tracks the practical V2 evaluation surface for Dodge Rush AR. The goal is not ML benchmarking; the goal is to confirm that gameplay remains readable, stable, and fair across the active V2 scope.

## Primary Metrics

### Gameplay Reliability
- Dodge success feels fair for RedWallLeft / RedWallRight / RedWallCenter
- Squat detection remains reliable for HighLaser
- Meteor hit vs dodge resolution remains readable
- Blue orb arbitration remains correct:
  - hands available -> grab-first
  - hands unavailable -> touch fallback

### Hand Interaction Quality
- Pinch enter / hold / release are stable
- Grab follow is readable
- Throw velocity requires intentional motion
- No double-score from touch + throw on the same orb

### Performance / Runtime
- Runtime profile is visible in HUD/debug
- Capability fallback is visible in loading/debug state
- Pose remains the highest-priority interactive path
- Hands stay prioritized over depth under load

## Manual Test Matrix

### A. Pose-only baseline
1. Start the game with hands off and depth off.
2. Verify RedWall dodge left/right behavior.
3. Verify HighLaser squat behavior.
4. Verify Meteor dodge/hit behavior.
5. Verify no runtime errors appear.

Pass conditions:
- body gameplay remains fully playable
- score / fail / miss feedback is correct

### B. Hands-enabled body + hand parallel play
1. Turn hands on.
2. Open debug and confirm landmarks appear.
3. Pinch and release repeatedly.
4. Dodge or squat while pinching.

Pass conditions:
- body and hand actions coexist in the same frame
- hand state comes from HandTracker surface, not pose-hand heuristics

### C. Blue orb touch fallback
1. Turn hands off.
2. Spawn or wait for BlueOrb.
3. Touch the orb with pose wrist overlap.

Pass conditions:
- `TOUCHED!` path still works
- orb resolves once

### D. Blue orb grab-first
1. Turn hands on.
2. Move a tracked hand near BlueOrb.
3. Confirm candidate / grabbed flow.
4. Ensure touch does not consume the orb once the hand interaction path has claimed it.

Pass conditions:
- candidate/grab path wins over touch
- no duplicate score

### E. Throw hit / miss
1. Grab a BlueOrb.
2. Release slowly and confirm weak toss / readable miss behavior.
3. Throw into RedWallLeft / Right / Center.
4. Throw into Meteor.
5. Throw through HighLaser.

Pass conditions:
- valid targets resolve once
- `BULLSEYE!` / projectile target feedback is distinct
- HighLaser is not destroyed or scored by thrown orbs

### F. Depth / occlusion path
1. Enable depth where supported.
2. Verify depth debug overlay with `F`.
3. Verify obstacle occlusion behind the player body.
4. Switch runtime profile to fallback and confirm depth yields appropriately.

Pass conditions:
- no crash when toggling depth
- fallback path remains playable even if depth is disabled

### G. Runtime profile / capability fallback
1. Observe loading screen capability label.
2. Observe HUD runtime status during gameplay.
3. Toggle profile with `P`.
4. Verify fallback disables or deprioritizes optional depth features.

Pass conditions:
- app surfaces the active fallback state clearly
- capability state matches observed behavior

## Suggested Session Checklist

For each browser/runtime under test, record:
- browser + version
- OS
- webcam resolution actually provided
- runtime profile chosen
- hands supported: yes/no
- depth supported: yes/no
- occlusion supported: yes/no
- observed fallback reason
- major gameplay regressions

## Acceptance Summary for Active V2

The active V2 release is acceptable when:
- pose gameplay works reliably in the primary browser target
- hand interaction works without breaking body gameplay
- thrown-orb interactions remain readable and single-resolution
- unsupported capability paths fail gracefully
- docs and browser matrix match the behavior of the current build
