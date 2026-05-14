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
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
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

    this.video.srcObject = this.stream
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
}
