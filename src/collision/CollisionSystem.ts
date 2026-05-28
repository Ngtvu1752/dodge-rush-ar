import type { Obstacle } from '../entities/Obstacle'
import type { RedWallCenter, RedWallLeft, RedWallRight } from '../entities/RedWall'
import type { HighLaser } from '../entities/HighLaser'
import type { BlueOrb } from '../entities/BlueOrb'
import type { Meteor } from '../entities/Meteor'
import type { ThrownOrb } from '../entities/ThrownOrb'
import type { PlayerAction } from '../input/GestureDetector'
import type { ScoreManager } from '../game/ScoreManager'
import type { PoseData } from '../pose/PoseTypes'
import {
  OBSTACLE_GRACE_WINDOW_MS,
  BASE_POINTS_SUCCESS,
  BASE_POINTS_ORB,
  ORB_TOUCH_MARGIN,
  RED_WALL_FORGIVENESS_MARGIN,
  OBSTACLE_Z_HIT_ZONE,
  METEOR_HIT_ZONE_Z,
  THROWN_ORB_BONUS_POINTS,
} from '../config/gameConfig'

type RedWall = RedWallLeft | RedWallRight | RedWallCenter

export type BlueOrbTouchPolicy = {
  allowTouch: boolean
  suppressTouchForOrbIds: ReadonlySet<string>
}

function isRedWall(o: Obstacle): o is RedWall {
  return o.type === 'RedWallLeft' || o.type === 'RedWallRight' || o.type === 'RedWallCenter'
}

function isHighLaser(o: Obstacle): o is HighLaser {
  return o.type === 'HighLaser'
}

function isBlueOrb(o: Obstacle): o is BlueOrb {
  return o.type === 'BlueOrb'
}

function isMeteor(o: Obstacle): o is Meteor {
  return o.type === 'Meteor'
}

export class CollisionSystem {
  evaluate(
    obstacles: readonly Obstacle[],
    action: PlayerAction,
    pose: PoseData,
    score: ScoreManager,
    timestamp: number,
    blueOrbTouchPolicy: BlueOrbTouchPolicy,
  ): void {
    for (const o of obstacles) {
      if (o.resolved) continue

      if (isRedWall(o)) {
        this.evaluateRedWall(o, pose, score, timestamp)
      } else if (isHighLaser(o)) {
        this.evaluateHighLaser(o, action, score, timestamp)
      } else if (isBlueOrb(o)) {
        this.evaluateBlueOrb(o, pose, score, blueOrbTouchPolicy)
      } else if (isMeteor(o)) {
        this.evaluateMeteor(o, pose, score, timestamp)
      }
    }
  }

  private evaluateRedWall(wall: RedWall, pose: PoseData, score: ScoreManager, timestamp: number): void {
    // Only evaluate when wall is at camera depth (z near 0) and in Y hit zone
    if (!wall.inHitZone || wall.z > OBSTACLE_Z_HIT_ZONE) return

    if (wall.graceStart === 0) {
      wall.graceStart = timestamp
    }

    if (timestamp - wall.graceStart >= OBSTACLE_GRACE_WINDOW_MS) {
      if (!pose.detected) {
        score.registerFail()
        wall.result = 'fail'
        wall.resolved = true
        return
      }

      const canvasW = window.innerWidth
      const canvasH = window.innerHeight

      // Convert torso landmarks to canvas coordinates (mirrored)
      const lsX = (1 - pose.leftShoulder.x) * canvasW
      const lsY = pose.leftShoulder.y * canvasH
      const rsX = (1 - pose.rightShoulder.x) * canvasW
      const rsY = pose.rightShoulder.y * canvasH
      const lhX = (1 - pose.leftHip.x) * canvasW
      const lhY = pose.leftHip.y * canvasH
      const rhX = (1 - pose.rightHip.x) * canvasW
      const rhY = pose.rightHip.y * canvasH

      // Player torso bounding box (handles leaning)
      const playerLeft = Math.min(lsX, lhX)
      const playerRight = Math.max(rsX, rhX)
      const playerTop = Math.min(lsY, rsY)
      const playerBottom = Math.max(lhY, rhY)

      // Wall bounding box with forgiveness margin on inner edge
      const margin = RED_WALL_FORGIVENESS_MARGIN * canvasW
      let wallLeft: number
      let wallRight: number

      if (wall.type === 'RedWallLeft') {
        wallLeft = wall.x
        wallRight = wall.x + wall.width - margin
      } else if (wall.type === 'RedWallRight') {
        wallLeft = wall.x + margin
        wallRight = wall.x + wall.width
      } else {
        wallLeft = wall.x + margin
        wallRight = wall.x + wall.width - margin
      }

      const wallTop = wall.y
      const wallBottom = wall.y + wall.height

      // AABB overlap test
      const overlap =
        playerLeft < wallRight &&
        playerRight > wallLeft &&
        playerTop < wallBottom &&
        playerBottom > wallTop

      if (overlap) {
        score.registerFail()
        wall.result = 'fail'
        wall.resultCause = undefined
      } else {
        score.registerSuccess(BASE_POINTS_SUCCESS)
        wall.result = 'success'
        wall.resultCause = 'dodge'
      }
      wall.resolved = true
    }
  }

  private evaluateHighLaser(laser: HighLaser, action: PlayerAction, score: ScoreManager, timestamp: number): void {
    // Only evaluate when laser is at camera depth (z near 0) and in Y hit zone
    if (!laser.inHitZone || laser.z > OBSTACLE_Z_HIT_ZONE) return

    if (laser.graceStart === 0) {
      laser.graceStart = timestamp
    }

    if (timestamp - laser.graceStart >= OBSTACLE_GRACE_WINDOW_MS) {
      if (action.squat) {
        score.registerSuccess(BASE_POINTS_SUCCESS)
        laser.result = 'success'
        laser.resultCause = 'dodge'
      } else {
        score.registerFail()
        laser.result = 'fail'
        laser.resultCause = undefined
      }
      laser.resolved = true
    }
  }

  private evaluateBlueOrb(orb: BlueOrb, pose: PoseData, score: ScoreManager, touchPolicy: BlueOrbTouchPolicy): void {
    if (orb.interactionState === 'grabbed' || orb.interactionState === 'thrown' || orb.interactionState === 'consumed') {
      return
    }

    // If orb expired (went off-screen), count as miss
    if (!orb.active && !orb.resolved) {
      score.registerMiss()
      orb.result = 'fail'
      orb.resultCause = undefined
      orb.resolved = true
      return
    }

    // Only check collision while orb is on screen
    if (orb.resolved) return

    if (!touchPolicy.allowTouch) return
    if (touchPolicy.suppressTouchForOrbIds.has(orb.id)) return

    if (!pose.detected) return

    // Convert normalized wrist positions to canvas coordinates (mirrored)
    const canvasW = window.innerWidth
    const canvasH = window.innerHeight

    const leftWristX = (1 - pose.leftWrist.x) * canvasW
    const leftWristY = pose.leftWrist.y * canvasH
    const rightWristX = (1 - pose.rightWrist.x) * canvasW
    const rightWristY = pose.rightWrist.y * canvasH

    // Use projected screen-space center and radius (matches visual position/size)
    const orbX = orb.centerX
    const orbY = orb.centerY
    const orbR = orb.screenRadius

    // Distance from orb center to each wrist
    const dxL = orbX - leftWristX
    const dyL = orbY - leftWristY
    const distLeft = Math.sqrt(dxL * dxL + dyL * dyL)

    const dxR = orbX - rightWristX
    const dyR = orbY - rightWristY
    const distRight = Math.sqrt(dxR * dxR + dyR * dyR)

    // Forgiving collision: scaled orb radius + generous margin
    const touchRadius = orbR + ORB_TOUCH_MARGIN

    if (distLeft <= touchRadius || distRight <= touchRadius) {
      score.registerSuccess(BASE_POINTS_ORB)
      orb.result = 'success'
      orb.resultCause = 'touch'
      orb.resolved = true
      orb.consume()
    }
  }

  private evaluateMeteor(meteor: Meteor, pose: PoseData, score: ScoreManager, timestamp: number): void {
    if (!meteor.inHitZone || meteor.worldZ > METEOR_HIT_ZONE_Z) return

    if (meteor.graceStart === 0) {
      meteor.graceStart = timestamp
    }

    if (timestamp - meteor.graceStart >= OBSTACLE_GRACE_WINDOW_MS) {
      if (!pose.detected) {
        score.registerFail()
        meteor.result = 'fail'
        meteor.resolved = true
        return
      }

      const canvasW = window.innerWidth
      const canvasH = window.innerHeight

      // Convert torso landmarks to canvas coordinates (mirrored)
      const lsX = (1 - pose.leftShoulder.x) * canvasW
      const lsY = pose.leftShoulder.y * canvasH
      const rsX = (1 - pose.rightShoulder.x) * canvasW
      const rsY = pose.rightShoulder.y * canvasH
      const lhX = (1 - pose.leftHip.x) * canvasW
      const lhY = pose.leftHip.y * canvasH
      const rhX = (1 - pose.rightHip.x) * canvasW
      const rhY = pose.rightHip.y * canvasH

      // Player torso AABB
      const playerLeft = Math.min(lsX, lhX)
      const playerRight = Math.max(rsX, rhX)
      const playerTop = Math.min(lsY, rsY)
      const playerBottom = Math.max(lhY, rhY)

      // Circle-vs-AABB test using projected screen-space values
      const cx = meteor.centerX
      const cy = meteor.centerY
      const r = meteor.screenRadius

      // Closest point on AABB to circle center
      const closestX = Math.max(playerLeft, Math.min(cx, playerRight))
      const closestY = Math.max(playerTop, Math.min(cy, playerBottom))

      const dx = cx - closestX
      const dy = cy - closestY
      const distSq = dx * dx + dy * dy

      if (distSq <= r * r) {
        score.registerFail()
        meteor.result = 'fail'
        meteor.resultCause = undefined
      } else {
        score.registerSuccess(BASE_POINTS_SUCCESS)
        meteor.result = 'success'
        meteor.resultCause = 'dodge'
      }
      meteor.resolved = true
    }
  }

  evaluateThrownOrbHits(thrownOrbs: readonly ThrownOrb[], obstacles: readonly Obstacle[], score: ScoreManager): void {
    for (const orb of thrownOrbs) {
      if (orb.resolved) continue

      for (const obstacle of obstacles) {
        if (obstacle.resolved || !obstacle.active) continue

        if (
          obstacle.type !== 'RedWallLeft' &&
          obstacle.type !== 'RedWallRight' &&
          obstacle.type !== 'RedWallCenter' &&
          obstacle.type !== 'Meteor'
        ) {
          continue
        }

        const left = obstacle.x
        const right = obstacle.x + obstacle.width
        const top = obstacle.y
        const bottom = obstacle.y + obstacle.height

        const closestX = Math.max(left, Math.min(orb.centerX, right))
        const closestY = Math.max(top, Math.min(orb.centerY, bottom))
        const dx = orb.centerX - closestX
        const dy = orb.centerY - closestY
        const hit = dx * dx + dy * dy <= orb.screenRadius * orb.screenRadius

        if (!hit) continue

        obstacle.resolved = true
        obstacle.result = 'success'
        obstacle.resultCause = 'projectile'
        obstacle.active = false
        orb.hitTargetId = obstacle.id
        orb.result = 'success'
        orb.resultCause = 'projectile'
        orb.resolved = true
        orb.active = false
        score.registerSuccess(THROWN_ORB_BONUS_POINTS)
        break
      }
    }
  }

  evaluateThrownOrbVsLaser(thrownOrbs: readonly ThrownOrb[], obstacles: readonly Obstacle[]): void {
    for (const orb of thrownOrbs) {
      if (orb.resolved) continue

      for (const obstacle of obstacles) {
        if (obstacle.type !== 'HighLaser' || obstacle.resolved || !obstacle.active) continue

        const left = obstacle.x
        const right = obstacle.x + obstacle.width
        const top = obstacle.y
        const bottom = obstacle.y + obstacle.height
        const overlap =
          orb.centerX + orb.screenRadius >= left &&
          orb.centerX - orb.screenRadius <= right &&
          orb.centerY + orb.screenRadius >= top &&
          orb.centerY - orb.screenRadius <= bottom

        if (!overlap) continue

        obstacle.resolved = true
        obstacle.result = 'success'
        obstacle.active = false
        orb.result = 'success'
        orb.resolved = true
        orb.active = false
        break
      }
    }
  }
}
