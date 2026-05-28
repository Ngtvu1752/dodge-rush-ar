import type { RuntimeProfile } from '../workers/AITypes'

export type RuntimeCapabilitySummary = {
  browserName: string
  webWorkerSupported: boolean
  imageBitmapSupported: boolean
  offscreenCanvasSupported: boolean
  webgl2Supported: boolean
  handsSupported: boolean
  depthSupported: boolean
  occlusionSupported: boolean
  recommendedProfile: RuntimeProfile
  fallbackReason: string
  capabilityLabel: string
}

function detectBrowserName(): string {
  const ua = navigator.userAgent

  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'

  return 'Unknown'
}

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!canvas.getContext('webgl2')
  } catch {
    return false
  }
}

export function detectRuntimeCapabilities(): RuntimeCapabilitySummary {
  const browserName = detectBrowserName()
  const webWorkerSupported = typeof Worker !== 'undefined'
  const imageBitmapSupported = typeof createImageBitmap === 'function'
  const offscreenCanvasSupported = typeof OffscreenCanvas !== 'undefined'
  const webgl2Supported = hasWebGL2()
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4

  const handsSupported = webWorkerSupported && imageBitmapSupported
  const depthSupported = webWorkerSupported && imageBitmapSupported && offscreenCanvasSupported
  const occlusionSupported = depthSupported && webgl2Supported

  let recommendedProfile: RuntimeProfile = 'balanced'
  const fallbackReasons: string[] = []

  if (!offscreenCanvasSupported) fallbackReasons.push('no-offscreen-canvas')
  if (!webgl2Supported) fallbackReasons.push('no-webgl2')
  if (cores < 4) fallbackReasons.push('low-cpu')
  if (memory < 4) fallbackReasons.push('low-memory')

  if (fallbackReasons.length > 0) {
    recommendedProfile = 'fallback'
  }

  return {
    browserName,
    webWorkerSupported,
    imageBitmapSupported,
    offscreenCanvasSupported,
    webgl2Supported,
    handsSupported,
    depthSupported,
    occlusionSupported,
    recommendedProfile,
    fallbackReason: fallbackReasons.join(',') || 'none',
    capabilityLabel: `${browserName} | hands=${handsSupported ? 'yes' : 'no'} depth=${depthSupported ? 'yes' : 'no'} occlusion=${occlusionSupported ? 'yes' : 'no'}`,
  }
}
