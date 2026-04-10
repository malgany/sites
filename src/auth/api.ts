import { getBrowserAuthSupabaseClient } from './client'
import { getAuthCallbackUrl } from './redirects'
import { assignBrowserLocation } from '../lib/browserNavigation'
import type { PremiumPurchaseOption } from '../types'

type CreateCheckoutSessionResponse = {
  checkoutUrl: string
}

async function getAuthFunctionHeaders() {
  const authClient = getBrowserAuthSupabaseClient()
  const { data, error } = await authClient.auth.refreshSession()

  if (error) {
    throw new Error(error.message || 'Could not refresh the auth session.')
  }

  const accessToken = data.session?.access_token?.trim()

  if (!accessToken) {
    throw new Error('Authentication required.')
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  }
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
  const headers = await getAuthFunctionHeaders()
  const { data, error } = await authClient.functions.invoke<CreateCheckoutSessionResponse>(
    'create-checkout-session',
    {
      body: {
        purchaseOption: options.purchaseOption,
        sourceSlug: options.sourceSlug?.trim() || null,
      },
      headers,
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
