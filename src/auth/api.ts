import { getBrowserAuthSupabaseClient } from './client'
import { getAuthCallbackUrl } from './redirects'
import { assignBrowserLocation } from '../lib/browserNavigation'
import type { PremiumPurchaseOption } from '../types'

type CreateCheckoutSessionResponse = {
  checkoutUrl: string
}

async function ensureAuthSession() {
  const authClient = getBrowserAuthSupabaseClient()
  const { data: { session } } = await authClient.auth.getSession()

  const isNearlyExpired = session?.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 60

  if (!session || isNearlyExpired) {
    const { data: { session: refreshedSession }, error } = await authClient.auth.refreshSession()
    if (error || !refreshedSession) {
      throw new Error(error?.message || 'Authentication required.')
    }
    return refreshedSession
  }

  return session
}

export async function requestMagicLink(email: string, nextPath: string) {
  const authClient = getBrowserAuthSupabaseClient()
  const { error } = await authClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(nextPath),
      shouldCreateUser: true,
    },
  })

  if (error) {
    throw new Error(error.message || 'Could not send the magic link.')
  }
}

export async function signInWithGoogle(nextPath: string) {
  const authClient = getBrowserAuthSupabaseClient()
  const { data, error } = await authClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        prompt: 'select_account',
      },
      redirectTo: getAuthCallbackUrl(nextPath),
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    throw new Error(error.message || 'Could not start Google sign in.')
  }

  if (!data?.url) {
    throw new Error('Google sign in did not return a redirect URL.')
  }

  assignBrowserLocation(data.url)
}

export async function exchangeAuthCode(code: string) {
  const authClient = getBrowserAuthSupabaseClient()
  const { error } = await authClient.auth.exchangeCodeForSession(code)

  if (error) {
    throw new Error(error.message || 'Could not confirm the auth session.')
  }
}

export async function exchangeMagicLinkCode(code: string) {
  await exchangeAuthCode(code)
}

export async function createPremiumCheckoutSession(options: {
  purchaseOption: PremiumPurchaseOption
  sourceSlug?: string | null
}) {
  const authClient = getBrowserAuthSupabaseClient()
  await ensureAuthSession()
  const { data, error } = await authClient.functions.invoke<CreateCheckoutSessionResponse>(
    'create-checkout-session',
    {
      body: {
        purchaseOption: options.purchaseOption,
        sourceSlug: options.sourceSlug?.trim() || null,
      },
    },
  )

  if (error) {
    throw new Error(error.message || 'Could not create the checkout session.')
  }

  if (!data?.checkoutUrl) {
    throw new Error('The checkout session did not return a redirect URL.')
  }

  return data.checkoutUrl
}
