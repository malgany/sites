import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPremiumCheckoutSession } from './api'
import { getBrowserAuthSupabaseClient } from './client'

vi.mock('./client', () => ({
  getBrowserAuthSupabaseClient: vi.fn(),
}))

const mockedGetBrowserAuthSupabaseClient = vi.mocked(getBrowserAuthSupabaseClient)

describe('auth api', () => {
  beforeEach(() => {
    mockedGetBrowserAuthSupabaseClient.mockReset()
  })

  it('sends the current access token when invoking the checkout function', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        checkoutUrl: 'https://checkout.stripe.test/session',
      },
      error: null,
    })
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'token-123',
        },
      },
      error: null,
    })

    mockedGetBrowserAuthSupabaseClient.mockReturnValue({
      auth: {
        getSession,
      },
      functions: {
        invoke,
      },
    } as never)

    await expect(
      createPremiumCheckoutSession({
        purchaseOption: 'installments_10',
        sourceSlug: 'nexora-hero',
      }),
    ).resolves.toBe(
      'https://checkout.stripe.test/session',
    )

    expect(invoke).toHaveBeenCalledWith('create-checkout-session', {
      body: {
        purchaseOption: 'installments_10',
        sourceSlug: 'nexora-hero',
      },
      headers: {
        Authorization: 'Bearer token-123',
      },
    })
  })
})
