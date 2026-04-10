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

  it('ensures a fresh session and invokes the checkout function without manual header overrides', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        checkoutUrl: 'https://checkout.stripe.test/session',
      },
      error: null,
    })
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    })
    const refreshSession = vi.fn().mockResolvedValue({
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
        refreshSession,
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

    expect(refreshSession).toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledWith('create-checkout-session', {
      body: {
        purchaseOption: 'installments_10',
        sourceSlug: 'nexora-hero',
      },
    })
  })
})
