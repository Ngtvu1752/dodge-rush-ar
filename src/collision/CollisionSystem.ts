import type { Obstacle } from '../entities/Obstacle'
import type { RedWallLeft, RedWallRight } from '../entities/RedWall'
import type { HighLaser } from '../entities/HighLaser'
import type { BlueOrb } from '../entities/BlueOrb'
import type { PlayerAction } from '../input/GestureDetector'
import type { ScoreManager } from '../game/ScoreManager'
import type { PoseData } from '../pose/PoseTypes'
import { OBSTACLE_GRACE_WINDOW_MS, BASE_POINTS_SUCCESS, BASE_POINTS_ORB, ORB_TOUCH_MARGIN } from '../config/gameConfig'

type RedWall = RedWallLeft | RedWallRight

function isRedWall(o: Obstacle): o is RedWall {
  return o.type === 'RedWallLeft' || o.type === 'RedWallRight'
}

function isHighLaser(o: Obstacle): o is HighLaser {
  return o.type === 'HighLaser'
}

function isBlueOrb(o: Obstacle): o is BlueOrb {
  return o.type === 'BlueOrb'
}

export class CollisionSystem {
  evaluate(obstacles: readonly Obstacle[], action: PlayerAction, pose: PoseData, score: ScoreManager, timestamp: number): void {
    for (const o of obstacles) {
      if (o.resolved) continue

      if (isRedWall(o)) {
        this.evaluateRedWall(o, action, score, timestamp)
      } else if (isHighLaser(o)) {
        this.evaluateHighLaser(o, action, score, timestamp)
      } else if (isBlueOrb(o)) {
        this.evaluateBlueOrb(o, pose, score)
      }
    }
  }

  private evaluateRedWall(wall: RedWall, action: PlayerAction, score: ScoreManager, timestamp: number): void {
    if (!wall.inHitZone) return

    if (wall.graceStart === 0) {
      wall.graceStart = timestamp
    }

    if (timestamp - wall.graceStart >= OBSTACLE_GRACE_WINDOW_MS) {
      const success =
        (wall.requiredAction === 'dodgeRight' && (action.dodgeRight || action.positionalSafeRight)) ||
        (wall.requiredAction === 'dodgeLeft' && (action.dodgeLeft || action.positionalSafeLeft))

      if (success) {
        score.registerSuccess(BASE_POINTS_SUCCESS)
        wall.result = 'success'
      } else {
        score.registerFail()
        wall.result = 'fail'
      }
      wall.resolved = true
    }
  }

  private evaluateHighLaser(laser: HighLaser, action: PlayerAction, score: ScoreManager, timestamp: number): void {
    if (!laser.inHitZone) return

    if (laser.graceStart === 0) {
      laser.graceStart = timestamp
    }

    if (timestamp - laser.graceStart >= OBSTACLE_GRACE_WINDOW_MS) {
      if (action.squat) {
        score.registerSuccess(BASE_POINTS_SUCCESS)
        laser.result = 'success'
      } else {
        score.registerFail()
        laser.result = 'fail'
      }
      laser.resolved = true
    }
  }

  private evaluateBlueOrb(orb: BlueOrb, pose: PoseData, score: ScoreManager): void {
    // If orb expired (went off-screen), count as miss
    if (!orb.active && !orb.resolved) {
      score.registerMiss()
      orb.result = 'fail'
      orb.resolved = true
      return
    }

    // Only check collision while orb is on screen
    if (!orb.inHitZone || orb.resolved) return

    if (!pose.detected) return

    // Convert normalized wrist positions to canvas coordinates (mirrored)
    const canvasW = window.innerWidth
    const canvasH = window.innerHeight

    const leftWristX = (1 - pose.leftWrist.x) * canvasW
    const leftWristY = pose.leftWrist.y * canvasH
    const rightWristX = (1 - pose.rightWrist.x) * canvasW
    const rightWristY = pose.rightWrist.y * canvasH

    // Distance from orb center to each wrist
    const dxL = orb.centerX - leftWristX
    const dyL = orb.centerY - leftWristY
    const distLeft = Math.sqrt(dxL * dxL + dyL * dyL)

    const dxR = orb.centerX - rightWristX
    const dyR = orb.centerY - rightWristY
    const distRight = Math.sqrt(dxR * dxR + dyR * dyR)

    // Forgiving collision: orb radius + generous margin
    const touchRadius = orb.radius + ORB_TOUCH_MARGIN

    if (distLeft <= touchRadius || distRight <= touchRadius) {
      score.registerSuccess(BASE_POINTS_ORB)
      orb.result = 'success'
      orb.resolved = true
    }
  }
}
