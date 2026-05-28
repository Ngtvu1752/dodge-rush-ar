export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error'

export class CameraManager {
  private video: HTMLVideoElement
  private stream: MediaStream | null = null
  private _status: CameraStatus = 'idle'
  private _errorMessage = ''

  constructor(videoElementId: string) {
    const video = document.getElementById(videoElementId)
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error(`Element #${videoElementId} is not a video element`)
    }
    this.video = video
  }

  async init(): Promise<boolean> {
    this._status = 'requesting'
    this._errorMessage = ''

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      })
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      } catch (err) {
        this._status = 'error'
        this._errorMessage =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera access denied. Please allow webcam permission and reload.'
            : 'Could not access webcam. Check that a camera is connected and not in use by another app.'
        return false
      }
    }

    await this.optimizeVideoTrack()

    this.video.srcObject = this.stream
    this.video.playsInline = true
    await this.video.play()
    this._status = 'active'
    return true
  }

  getVideo(): HTMLVideoElement {
    return this.video
  }

  get status(): CameraStatus {
    return this._status
  }

  get errorMessage(): string {
    return this._errorMessage
  }

  get isReady(): boolean {
    return this._status === 'active' && this.video.readyState >= 2
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
    this._status = 'idle'
  }

  private async optimizeVideoTrack(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0]
    if (!track || typeof track.getCapabilities !== 'function') return

    const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
      exposureMode?: string[]
      whiteBalanceMode?: string[]
      focusMode?: string[]
      sharpness?: { min?: number; max?: number }
      brightness?: { min?: number; max?: number }
      contrast?: { min?: number; max?: number }
      saturation?: { min?: number; max?: number }
      colorTemperature?: { min?: number; max?: number }
    }

    const advanced: Record<string, unknown> = {}

    if (capabilities.exposureMode?.includes('manual')) {
      advanced.exposureMode = 'manual'
    }
    if (capabilities.whiteBalanceMode?.includes('manual')) {
      advanced.whiteBalanceMode = 'manual'
    }
    if (capabilities.focusMode?.includes('continuous')) {
      advanced.focusMode = 'continuous'
    }
    if (capabilities.sharpness?.max !== undefined) {
      advanced.sharpness = capabilities.sharpness.max
    }
    if (capabilities.contrast?.min !== undefined && capabilities.contrast?.max !== undefined) {
      advanced.contrast = capabilities.contrast.min + (capabilities.contrast.max - capabilities.contrast.min) * 0.62
    }
    if (capabilities.saturation?.min !== undefined && capabilities.saturation?.max !== undefined) {
      advanced.saturation = capabilities.saturation.min + (capabilities.saturation.max - capabilities.saturation.min) * 0.48
    }
    if (capabilities.brightness?.min !== undefined && capabilities.brightness?.max !== undefined) {
      advanced.brightness = capabilities.brightness.min + (capabilities.brightness.max - capabilities.brightness.min) * 0.42
    }
    if (capabilities.colorTemperature?.min !== undefined && capabilities.colorTemperature?.max !== undefined) {
      advanced.colorTemperature = capabilities.colorTemperature.min + (capabilities.colorTemperature.max - capabilities.colorTemperature.min) * 0.5
    }

    if (Object.keys(advanced).length === 0) return

    try {
      await track.applyConstraints({ advanced: [advanced] })
    } catch {
      // Browsers often ignore or partially reject advanced webcam controls.
    }
  }
}
