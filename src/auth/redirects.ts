const DEFAULT_POST_AUTH_PATH = '/pricing/'

export function getDefaultPostAuthPath() {
  return DEFAULT_POST_AUTH_PATH
}

export function normalizeNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return DEFAULT_POST_AUTH_PATH
  }

  return nextPath
}

export function getCurrentPricingPath() {
  if (typeof window === 'undefined') {
    return DEFAULT_POST_AUTH_PATH
  }

  return window.location.search
    ? `/pricing/${window.location.search}`
    : DEFAULT_POST_AUTH_PATH
}

export function getAuthCallbackUrl(nextPath: string) {
  if (typeof window === 'undefined') {
    throw new Error('Auth callback URLs can only be created in the browser.')
  }

  const callbackUrl = new URL('/auth/callback/', window.location.origin)
  callbackUrl.searchParams.set('next', normalizeNextPath(nextPath))

  return callbackUrl.toString()
}
