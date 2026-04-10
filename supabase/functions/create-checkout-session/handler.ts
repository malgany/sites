import { jsonResponse, handleCorsPreflightRequest } from '../_shared/http.ts'
import type { StripePurchaseOption } from '../_shared/stripe.ts'
import type { ServiceClient, UserClient } from '../_shared/types.ts'

type CreateCheckoutSessionDeps = {
  createServiceClient: () => ServiceClient
  createStripeCheckoutSession: (options: {
    customerId: string
    purchaseOption: StripePurchaseOption
    priceId: string
    secretKey: string
    siteUrl: string
    sourceSlug: string | null
    userId: string
  }) => Promise<{ id: string; url: string | null }>
  createStripeCustomer: (options: {
    email: string
    secretKey: string
    userId: string
  }) => Promise<{ id: string }>
  createUserClient: (authorizationHeader: string | null) => UserClient
  getRequiredEnv: (name: string) => string
}

function normalizeSourceSlug(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function normalizePurchaseOption(value: unknown): StripePurchaseOption {
  return value === 'installments_10' ? 'installments_10' : 'one_time'
}

function getPremiumPriceId(
  deps: Pick<CreateCheckoutSessionDeps, 'getRequiredEnv'>,
  purchaseOption: StripePurchaseOption,
) {
  if (purchaseOption === 'installments_10') {
    return deps.getRequiredEnv('STRIPE_PREMIUM_INSTALLMENTS_10_PRICE_ID')
  }

  try {
    return deps.getRequiredEnv('STRIPE_PREMIUM_ONE_TIME_PRICE_ID')
  } catch {
    return deps.getRequiredEnv('STRIPE_PREMIUM_PRICE_ID')
  }
}

export function createCreateCheckoutSessionHandler(deps: CreateCheckoutSessionDeps) {
  return async function handleCreateCheckoutSession(request: Request) {
    const corsResponse = handleCorsPreflightRequest(request)

    if (corsResponse) {
      return corsResponse
    }

    if (request.method !== 'POST') {
      return jsonResponse(405, {
        error: 'Method not allowed.',
      })
    }

    try {
      const userClient = deps.createUserClient(request.headers.get('Authorization'))
      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser()

      if (userError || !user) {
        return jsonResponse(401, {
          error: 'Authentication required.',
        })
      }

      if (!user.email) {
        return jsonResponse(400, {
          error: 'Authenticated users must have an e-mail before checkout.',
        })
      }

      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      const purchaseOption = normalizePurchaseOption(body.purchaseOption)
      const sourceSlug = normalizeSourceSlug(body.sourceSlug)
      const serviceClient = deps.createServiceClient()
      const accessLookup = await serviceClient
        .from('user_access')
        .select('status, stripe_customer_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (accessLookup.error) {
        throw new Error(accessLookup.error.message)
      }

      if (accessLookup.data?.status === 'active') {
        return jsonResponse(409, {
          error: 'Premium access is already active for this account.',
        })
      }

      const stripeSecretKey = deps.getRequiredEnv('STRIPE_SECRET_KEY')
      const stripePremiumPriceId = getPremiumPriceId(deps, purchaseOption)
      const siteUrl = deps.getRequiredEnv('SITE_URL')

      console.log('Creating checkout session:', {
        purchaseOption,
        priceId: stripePremiumPriceId,
        siteUrl,
        userId: user.id,
        isProduction: siteUrl.includes('prompt-archive.xyz')
      })

      let customerId = accessLookup.data?.stripe_customer_id ?? null

      if (!customerId) {
        const customer = await deps.createStripeCustomer({
          email: user.email,
          secretKey: stripeSecretKey,
          userId: user.id,
        })
        customerId = customer.id
      }

      const checkoutSession = await deps.createStripeCheckoutSession({
        customerId,
        purchaseOption,
        priceId: stripePremiumPriceId,
        secretKey: stripeSecretKey,
        siteUrl,
        sourceSlug,
        userId: user.id,
      })

      if (!checkoutSession.url) {
        throw new Error('Stripe checkout session did not return a URL.')
      }

      const accessUpsert = await serviceClient.from('user_access').upsert(
        {
          user_id: user.id,
          plan_code: 'premium',
          purchase_option: purchaseOption,
          revoked_at: null,
          source_slug: sourceSlug,
          status: 'pending',
          billing_status: 'pending',
          stripe_checkout_session_id: checkoutSession.id,
          stripe_customer_id: customerId,
          stripe_payment_intent_id: null,
          stripe_subscription_id: null,
          stripe_subscription_schedule_id: null,
        },
        {
          onConflict: 'user_id',
        },
      )

      if (accessUpsert.error) {
        throw new Error(accessUpsert.error.message)
      }

      return jsonResponse(200, {
        checkoutUrl: checkoutSession.url,
      })
    } catch (error) {
      console.error('Could not create checkout session.', error)
      return jsonResponse(500, {
        error: error instanceof Error ? error.message : 'Could not create checkout session.',
        details: error instanceof Error ? error.stack : undefined,
      })
    }
  }
}
