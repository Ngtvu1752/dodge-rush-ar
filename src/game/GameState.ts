export const GameState = {
  Loading: 'Loading',
  CameraPermission: 'CameraPermission',
  Calibration: 'Calibration',
  Ready: 'Ready',
  Countdown: 'Countdown',
  Playing: 'Playing',
  GameOver: 'GameOver',
  Result: 'Result',
} as const

export type GameState = (typeof GameState)[keyof typeof GameState]
