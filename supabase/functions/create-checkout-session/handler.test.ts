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

  it('creates a pending premium record and returns the checkout url', async () => {
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
      getRequiredEnv: vi.fn((name: string) => {
        if (name === 'STRIPE_SECRET_KEY') {
          return 'sk_test'
        }

        if (name === 'STRIPE_PREMIUM_PRICE_ID') {
          return 'price_123'
        }

        if (name === 'SITE_URL') {
          return 'https://prompt.test'
        }

        return ''
      }),
    })

    const response = await handler(
      new Request('https://example.com/create-checkout-session', {
        body: JSON.stringify({
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
      priceId: 'price_123',
      secretKey: 'sk_test',
      siteUrl: 'https://prompt.test',
      sourceSlug: 'nexora-hero',
      userId: 'user-123',
    })
    expect(service.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_code: 'premium',
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
})
