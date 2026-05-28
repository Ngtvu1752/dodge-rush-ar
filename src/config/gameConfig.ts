export const SMOOTHING_FACTOR = 0.35
export const POSE_LOSS_GRACE_MS = 200

export const CALIBRATION_DURATION_MS = 2000
export const DODGE_THRESHOLD_MULTIPLIER = 0.45
export const SQUAT_THRESHOLD_MULTIPLIER = 0.25

export const GESTURE_HOLD_MS = 120

export const COUNTDOWN_SECONDS = 3

export const MAX_HEALTH = 3
export const GAME_DURATION_SEC = 60
export const BASE_POINTS_SUCCESS = 100
export const BASE_POINTS_ORB = 150
export const COMBO_THRESHOLDS = [0, 10, 20]
export const MULTIPLIERS = [1.0, 1.5, 2.0]

export const OBSTACLE_SPAWN_INTERVAL = 1.5
export const OBSTACLE_SPEED = 300
export const OBSTACLE_GRACE_WINDOW_MS = 200
export const ORB_TOUCH_MARGIN = 40
export const ORB_LIFETIME_SEC = 6.0
export const RED_WALL_FORGIVENESS_MARGIN = 0.05

// Difficulty phases
export const DIFFICULTY_EASY_END = 20
export const DIFFICULTY_MEDIUM_END = 40

export const DIFFICULTY_SPEED_EASY = 250
export const DIFFICULTY_SPEED_MEDIUM = 350
export const DIFFICULTY_SPEED_HARD = 450

export const DIFFICULTY_INTERVAL_EASY = 1.6
export const DIFFICULTY_INTERVAL_MEDIUM = 1.2
export const DIFFICULTY_INTERVAL_HARD = 0.9

// Fairness: minimum seconds between dangerous obstacles (RedWall/HighLaser)
export const FAIRNESS_DANGEROUS_GAP_SEC = 1.0

// ── V2: AI Worker Configuration ──
export const AI_WORKER_TARGET_INFERENCE_MS = 45
export const AI_WORKER_FRAME_BUDGET_MS = 45
export const HAND_PINCH_ENTER_THRESHOLD = 0.045
export const HAND_PINCH_EXIT_THRESHOLD = 0.075
export const HAND_GRAB_HOLD_MS = 100
export const HAND_TRACKING_GRACE_MS = 120
export const HAND_GRAB_COOLDOWN_MS = 180
export const HAND_VELOCITY_HISTORY_SIZE = 5
export const HAND_GRAB_RADIUS_PX = 95
export const HAND_THROW_SPEED_THRESHOLD = 760
export const HAND_PREDICTION_LEAD_MS = 28
export const HAND_PREDICTION_MAX_DISTANCE_PX = 42
export const HAND_PREDICTION_MIN_CONFIDENCE = 0.45
export const HAND_SMOOTHING_OPEN = 0.58
export const HAND_SMOOTHING_PINCHING = 0.5
export const HAND_SMOOTHING_GRABBED = 0.34
export const HAND_INTERACTION_PLANE_Z = 140
export const HAND_THROW_Z_VELOCITY = 700
export const THROWN_ORB_GRAVITY = 720
export const THROWN_ORB_LIFETIME_SEC = 3.0
export const THROWN_ORB_BASE_SPEED_SCALE = 1.05
export const THROWN_ORB_WEAK_TOSS_FACTOR = 0.5
export const THROWN_ORB_UPWARD_LIFT = 150
export const THROWN_ORB_THROW_UPWARD_LIFT = 240
export const THROWN_ORB_BONUS_POINTS = 200

// ── V2: Depth Occlusion ──
export const DEPTH_OCCLUSION_THRESHOLD = 0.15
export const DEPTH_OCCLUSION_SOFT_EDGE = 0.08

// ── V2: Z-Axis Obstacle Movement ──
export const VANISHING_POINT_FOCAL_LENGTH = 400
export const OBSTACLE_SPAWN_Z = 1000       // Spawn depth in world units (large = far)
export const OBSTACLE_Z_HIT_ZONE = 100     // World-Z below this = in hit zone for collision
export const OBSTACLE_Z_DESPAWN = 120      // Keep obstacle alive slightly past camera so grace-window collision can resolve
export const RED_WALL_SPAWN_SIDE_MIN = 0.18
export const RED_WALL_SPAWN_SIDE_MAX = 0.42
export const RED_WALL_SPAWN_Y_MIN = -0.32
export const RED_WALL_SPAWN_Y_MAX = -0.08
export const RED_WALL_CENTER_WIDTH_RATIO = 0.3
export const RED_WALL_CENTER_X_JITTER = 0.06
// BlueOrb still uses these (different coordinate model)
export const BLUE_ORB_SPAWN_Z_MIN = 380
export const BLUE_ORB_SPAWN_Z_MAX = 680
export const BLUE_ORB_APPROACH_SPEED_FACTOR = 0.14
export const BLUE_ORB_MIN_GAP_SEC = 5.5
export const BLUE_ORB_FORCE_GAP_SEC = 8.0
export const BLUE_ORB_SPAWN_X_LANES = [-0.28, -0.14, 0, 0.14, 0.28] as const
export const BLUE_ORB_SPAWN_X_JITTER = 0.035
export const BLUE_ORB_SPAWN_Y_BANDS = [-0.12, -0.02, 0.08, 0.18] as const
export const BLUE_ORB_SPAWN_Y_JITTER = 0.03

// ── V2: Meteor ──
export const METEOR_SPAWN_Z = 1200
export const METEOR_HIT_ZONE_Z = 120
export const METEOR_DESPAWN_Z = 50
export const METEOR_SCREEN_RADIUS = 80
export const METEOR_SPIN_SPEED = 1.5
