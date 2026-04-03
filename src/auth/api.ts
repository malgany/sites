import { getBrowserAuthSupabaseClient } from './client'
import { getAuthCallbackUrl } from './redirects'

type CreateCheckoutSessionResponse = {
  checkoutUrl: string
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

export async function exchangeMagicLinkCode(code: string) {
  const authClient = getBrowserAuthSupabaseClient()
  const { error } = await authClient.auth.exchangeCodeForSession(code)

  if (error) {
    throw new Error(error.message || 'Could not confirm the magic link.')
  }
}

export async function createPremiumCheckoutSession(sourceSlug?: string | null) {
  const authClient = getBrowserAuthSupabaseClient()
  const { data, error } = await authClient.functions.invoke<CreateCheckoutSessionResponse>(
    'create-checkout-session',
    {
      body: {
        sourceSlug: sourceSlug?.trim() || null,
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
