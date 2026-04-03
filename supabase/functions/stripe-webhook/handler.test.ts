import { describe, expect, it, vi } from 'vitest'
import { createStripeWebhookHandler } from './handler.ts'
import type { StripeWebhookEvent } from '../_shared/stripe.ts'

function createStripeWebhookRequest() {
  return new Request('https://example.com/stripe-webhook', {
    body: '{}',
    headers: {
      'stripe-signature': 't=test,v1=test',
    },
    method: 'POST',
  })
}

function createServiceClient(options?: {
  existingEvent?: Record<string, unknown> | null
}) {
  const existingEvent = options?.existingEvent ?? null
  const webhookEventMaybeSingle = vi.fn().mockResolvedValue({
    data: existingEvent,
    error: null,
  })
  const webhookEventEq = vi.fn(() => ({
    maybeSingle: webhookEventMaybeSingle,
  }))
  const webhookEventSelect = vi.fn(() => ({
    eq: webhookEventEq,
  }))
  const webhookEventUpsert = vi.fn().mockResolvedValue({
    error: null,
  })
  const webhookEventUpdateEq = vi.fn().mockResolvedValue({
    error: null,
  })
  const webhookEventUpdate = vi.fn(() => ({
    eq: webhookEventUpdateEq,
  }))

  const userAccessUpsert = vi.fn().mockResolvedValue({
    error: null,
  })
  const userAccessUpdateEq = vi.fn().mockResolvedValue({
    error: null,
  })
  const userAccessUpdate = vi.fn(() => ({
    eq: userAccessUpdateEq,
  }))

  const from = vi.fn((table: string) => {
    if (table === 'stripe_webhook_events') {
      return {
        select: webhookEventSelect,
        update: webhookEventUpdate,
        upsert: webhookEventUpsert,
      }
    }

    return {
      update: userAccessUpdate,
      upsert: userAccessUpsert,
    }
  })

  return {
    client: {
      from,
    },
    userAccessUpdateEq,
    userAccessUpsert,
    webhookEventUpsert,
  }
}

function createHandler(event: StripeWebhookEvent, existingEvent?: Record<string, unknown> | null) {
  const service = createServiceClient({
    existingEvent,
  })
  const handler = createStripeWebhookHandler({
    createServiceClient: () => service.client,
    getRequiredEnv: vi.fn(() => 'whsec_test'),
    verifyStripeWebhookEvent: vi.fn().mockResolvedValue(event),
  })

  return {
    handler,
    service,
  }
}

describe('stripe-webhook handler', () => {
  it('returns a duplicate response when the event was already processed', async () => {
    const { handler, service } = createHandler(
      {
        id: 'evt_duplicate',
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'user-123',
            id: 'cs_123',
          },
        },
      },
      {
        processed_at: '2026-04-03T12:00:00.000Z',
      },
    )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      duplicate: true,
      received: true,
    })
    expect(service.webhookEventUpsert).not.toHaveBeenCalled()
  })

  it('activates premium access when checkout.session.completed arrives', async () => {
    const { handler, service } = createHandler({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-123',
          customer: 'cus_123',
          id: 'cs_123',
          metadata: {
            source_slug: 'nexora-hero',
            user_id: 'user-123',
          },
          payment_intent: 'pi_123',
        },
      },
    })

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
    })
    expect(service.userAccessUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_code: 'premium',
        source_slug: 'nexora-hero',
        status: 'active',
        stripe_checkout_session_id: 'cs_123',
        stripe_customer_id: 'cus_123',
        stripe_payment_intent_id: 'pi_123',
        user_id: 'user-123',
      }),
      {
        onConflict: 'user_id',
      },
    )
  })

  it('revokes premium access for refunded charges', async () => {
    const { handler, service } = createHandler({
      id: 'evt_refund',
      type: 'charge.refunded',
      data: {
        object: {
          customer: 'cus_123',
          payment_intent: 'pi_123',
        },
      },
    })

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpdateEq).toHaveBeenCalledWith(
      'stripe_payment_intent_id',
      'pi_123',
    )
  })
})
