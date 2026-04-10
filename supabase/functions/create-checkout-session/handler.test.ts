import { describe, expect, it, vi } from 'vitest'
import { createCreateCheckoutSessionHandler } from './handler.ts'

function createUserClient(user: { email?: string | null; id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user,
        },
        error: null,
      }),
    },
  }
}

function createServiceClient(accessRow: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: accessRow,
    error: null,
  })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const upsert = vi.fn().mockResolvedValue({
    error: null,
  })
  const from = vi.fn(() => ({
    select,
    upsert,
  }))

  return {
    client: {
      from,
    },
    from,
    maybeSingle,
    upsert,
  }
}

function createEnvGetter(overrides?: Record<string, string>) {
  return vi.fn((name: string) => {
    const values = {
      SITE_URL: 'https://prompt.test',
      STRIPE_PREMIUM_INSTALLMENTS_10_PRICE_ID: 'price_installments',
      STRIPE_PREMIUM_ONE_TIME_PRICE_ID: 'price_one_time',
      STRIPE_PREMIUM_PRICE_ID: 'price_fallback',
      STRIPE_SECRET_KEY: 'sk_test',
      ...overrides,
    }

    const value = values[name as keyof typeof values]

    if (!value) {
      throw new Error(`Missing ${name}.`)
    }

    return value
  })
}

describe('create-checkout-session handler', () => {
  it('rejects unauthenticated requests', async () => {
    const handler = createCreateCheckoutSessionHandler({
      createServiceClient: () => createServiceClient(null).client,
      createStripeCheckoutSession: vi.fn(),
      createStripeCustomer: vi.fn(),
      createUserClient: () => createUserClient(null),
      getRequiredEnv: vi.fn(),
    })

    const response = await handler(
      new Request('https://example.com/create-checkout-session', {
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required.',
    })
  })

  it('creates a pending one-time checkout and stores the selected purchase option', async () => {
    const service = createServiceClient(null)
    const createStripeCustomer = vi.fn().mockResolvedValue({
      id: 'cus_123',
    })
    const createStripeCheckoutSession = vi.fn().mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.test/session',
    })
    const handler = createCreateCheckoutSessionHandler({
      createServiceClient: () => service.client,
      createStripeCheckoutSession,
      createStripeCustomer,
      createUserClient: () =>
        createUserClient({
          email: 'user@example.com',
          id: 'user-123',
        }),
      getRequiredEnv: createEnvGetter(),
    })

    const response = await handler(
      new Request('https://example.com/create-checkout-session', {
        body: JSON.stringify({
          purchaseOption: 'one_time',
          sourceSlug: 'nexora-hero',
        }),
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      checkoutUrl: 'https://checkout.stripe.test/session',
    })
    expect(createStripeCustomer).toHaveBeenCalledWith({
      email: 'user@example.com',
      secretKey: 'sk_test',
      userId: 'user-123',
    })
    expect(createStripeCheckoutSession).toHaveBeenCalledWith({
      customerId: 'cus_123',
      priceId: 'price_one_time',
      purchaseOption: 'one_time',
      secretKey: 'sk_test',
      siteUrl: 'https://prompt.test',
      sourceSlug: 'nexora-hero',
      userId: 'user-123',
    })
    expect(service.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'pending',
        plan_code: 'premium',
        purchase_option: 'one_time',
        source_slug: 'nexora-hero',
        status: 'pending',
        stripe_checkout_session_id: 'cs_123',
        stripe_customer_id: 'cus_123',
        user_id: 'user-123',
      }),
      {
        onConflict: 'user_id',
      },
    )
  })

  it('uses the installments price id for the recurring checkout option', async () => {
    const service = createServiceClient({
      stripe_customer_id: 'cus_existing',
      status: 'pending',
    })
    const createStripeCheckoutSession = vi.fn().mockResolvedValue({
      id: 'cs_installments',
      url: 'https://checkout.stripe.test/installments',
    })
    const handler = createCreateCheckoutSessionHandler({
      createServiceClient: () => service.client,
      createStripeCheckoutSession,
      createStripeCustomer: vi.fn(),
      createUserClient: () =>
        createUserClient({
          email: 'user@example.com',
          id: 'user-123',
        }),
      getRequiredEnv: createEnvGetter(),
    })

    const response = await handler(
      new Request('https://example.com/create-checkout-session', {
        body: JSON.stringify({
          purchaseOption: 'installments_10',
          sourceSlug: 'nexora-hero',
        }),
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    expect(createStripeCheckoutSession).toHaveBeenCalledWith({
      customerId: 'cus_existing',
      priceId: 'price_installments',
      purchaseOption: 'installments_10',
      secretKey: 'sk_test',
      siteUrl: 'https://prompt.test',
      sourceSlug: 'nexora-hero',
      userId: 'user-123',
    })
  })

  it('falls back to STRIPE_PREMIUM_PRICE_ID for one-time checkout during rollout', async () => {
    const service = createServiceClient(null)
    const createStripeCheckoutSession = vi.fn().mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.test/session',
    })
    const handler = createCreateCheckoutSessionHandler({
      createServiceClient: () => service.client,
      createStripeCheckoutSession,
      createStripeCustomer: vi.fn().mockResolvedValue({
        id: 'cus_123',
      }),
      createUserClient: () =>
        createUserClient({
          email: 'user@example.com',
          id: 'user-123',
        }),
      getRequiredEnv: createEnvGetter({
        STRIPE_PREMIUM_ONE_TIME_PRICE_ID: '',
      }),
    })

    const response = await handler(
      new Request('https://example.com/create-checkout-session', {
        body: JSON.stringify({
          purchaseOption: 'one_time',
        }),
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    expect(createStripeCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_fallback',
      }),
    )
  })
})
