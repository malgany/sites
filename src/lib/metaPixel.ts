type MetaPixelValue = string | number | boolean | null

type MetaPixelParams = Record<string, MetaPixelValue>

type MetaPixelFunction = {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[][]
  loaded?: boolean
  version?: string
  push?: (...args: unknown[]) => void
}

declare global {
  interface Window {
    fbq?: MetaPixelFunction
    _fbq?: MetaPixelFunction
    __promptArchiveMetaPixelInitialized?: boolean
  }
}

const META_PIXEL_ID = '1308843311105222'

function createMetaPixelFunction() {
  const fbq: MetaPixelFunction = (...args: unknown[]) => {
    if (typeof fbq.callMethod === 'function') {
      fbq.callMethod(...args)
      return
    }

    fbq.queue?.push(args)
  }

  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.push = (...args: unknown[]) => {
    fbq(...args)
  }

  return fbq
}

export function initializeMetaPixel() {
  if (typeof window === 'undefined' || window.__promptArchiveMetaPixelInitialized) {
    return
  }

  const existingFbq = window.fbq
  const fbq = existingFbq ?? createMetaPixelFunction()

  if (!existingFbq) {
    window.fbq = fbq
    window._fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'

    const firstScript = document.getElementsByTagName('script')[0]

    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript)
    } else {
      document.head.appendChild(script)
    }
  }

  fbq('init', META_PIXEL_ID)
  fbq('track', 'PageView')
  window.__promptArchiveMetaPixelInitialized = true
}

export function trackMetaEvent(eventName: string, params?: MetaPixelParams) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') {
    return
  }

  if (params) {
    window.fbq('track', eventName, params)
    return
  }

  window.fbq('track', eventName)
}
