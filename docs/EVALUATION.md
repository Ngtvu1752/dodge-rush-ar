# Evaluation Plan

## Purpose
Determine if Dodge Rush AR provides a reliable and fair experience. Focus is on gameplay reliability rather than academic model benchmarking.

## Key Metrics

### 1. Gesture Accuracy
Correct Detections / Total Attempts.
- Target: Dodge (90%), Squat (85%), Hand Touch (85%).

### 2. False Positive Rate
Gestures detected when player is idle.
- Target: < 3 events per minute.

### 3. False Negative Rate
Missed detections when player performs action.
- Target: < 15%.

### 4. Performance
- Render FPS: >= 30.
- Pose FPS: >= 20.
- Latency: < 200ms.

### 5. Player-Perceived Fairness
Subjective rating (1-5 scale).
- Target: Average >= 4/5.

## Test Procedures
- **Test A**: Gesture Accuracy (30 attempts per gesture).
- **Test B**: Idle Test (60s standing still).
- **Test C**: Gameplay Sessions (3 sessions per tester).
- **Test D**: Environment Robustness (lighting/background variation).

## Result Summary
The result screen should display:
- Final Score & Best Combo.
- Total Obstacles vs. Successes.
- Accuracy % (Successes / Total Obstacles).