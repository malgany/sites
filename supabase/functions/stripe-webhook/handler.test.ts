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
  userAccessLookups?: Record<string, Record<string, unknown> | null>
}) {
  const existingEvent = options?.existingEvent ?? null
  const userAccessLookups = options?.userAccessLookups ?? {}
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
  const userAccessEq = vi.fn((column: string, value: string) => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: userAccessLookups[`${column}:${value}`] ?? null,
      error: null,
    }),
  }))
  const userAccessSelect = vi.fn(() => ({
    eq: userAccessEq,
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
      select: userAccessSelect,
      update: userAccessUpdate,
      upsert: userAccessUpsert,
    }
  })

  return {
    client: {
      from,
    },
    userAccessEq,
    userAccessUpdate,
    userAccessUpdateEq,
    userAccessUpsert,
    webhookEventUpsert,
  }
}

function createHandler(
  event: StripeWebhookEvent,
  options?: {
    existingEvent?: Record<string, unknown> | null
    userAccessLookups?: Record<string, Record<string, unknown> | null>
  },
) {
  const service = createServiceClient(options)
  const createStripeSubscriptionScheduleFromSubscription = vi.fn().mockResolvedValue({
    id: 'sub_sched_123',
  })
  const updateStripeSubscriptionSchedule = vi.fn().mockResolvedValue({
    id: 'sub_sched_123',
  })
  const handler = createStripeWebhookHandler({
    createServiceClient: () => service.client,
    createStripeSubscriptionScheduleFromSubscription,
    getRequiredEnv: vi.fn((name: string) => {
      if (name === 'STRIPE_WEBHOOK_SECRET') {
        return 'whsec_test'
      }

      if (name === 'STRIPE_SECRET_KEY') {
        return 'sk_test'
      }

      return ''
    }),
    updateStripeSubscriptionSchedule,
    verifyStripeWebhookEvent: vi.fn().mockResolvedValue(event),
  })

  return {
    createStripeSubscriptionScheduleFromSubscription,
    handler,
    service,
    updateStripeSubscriptionSchedule,
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
        existingEvent: {
          processed_at: '2026-04-03T12:00:00.000Z',
        },
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

  it('activates premium access for one-time checkout.session.completed', async () => {
    const { handler, service } = createHandler({
      id: 'evt_checkout_one_time',
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-123',
          customer: 'cus_123',
          id: 'cs_123',
          metadata: {
            purchase_option: 'one_time',
            source_slug: 'nexora-hero',
            user_id: 'user-123',
          },
          payment_intent: 'pi_123',
        },
      },
    })

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'active',
        plan_code: 'premium',
        purchase_option: 'one_time',
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

  it('stores installments checkout as pending until invoice.paid arrives', async () => {
    const { handler, service } = createHandler({
      id: 'evt_checkout_installments',
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-123',
          customer: 'cus_123',
          id: 'cs_123',
          metadata: {
            purchase_option: 'installments_10',
            source_slug: 'nexora-hero',
            user_id: 'user-123',
          },
          subscription: 'sub_123',
        },
      },
    })

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'pending',
        purchase_option: 'installments_10',
        status: 'pending',
        stripe_subscription_id: 'sub_123',
        user_id: 'user-123',
      }),
      {
        onConflict: 'user_id',
      },
    )
  })

  it('activates installments on invoice.paid and creates the subscription schedule', async () => {
    const accessRow = {
      billing_status: 'pending',
      granted_at: null,
      plan_code: 'premium',
      purchase_option: 'installments_10',
      source_slug: 'nexora-hero',
      status: 'pending',
      stripe_checkout_session_id: 'cs_123',
      stripe_customer_id: 'cus_123',
      stripe_payment_intent_id: null,
      stripe_subscription_id: 'sub_123',
      stripe_subscription_schedule_id: null,
      user_id: 'user-123',
    }
    const { createStripeSubscriptionScheduleFromSubscription, handler, service, updateStripeSubscriptionSchedule } =
      createHandler(
        {
          id: 'evt_invoice_paid',
          type: 'invoice.paid',
          data: {
            object: {
              customer: 'cus_123',
              lines: {
                data: [
                  {
                    period: {
                      start: 1712700000,
                    },
                    price: {
                      id: 'price_installments',
                    },
                    quantity: 1,
                  },
                ],
              },
              payment_intent: 'pi_invoice_123',
              subscription: 'sub_123',
            },
          },
        },
        {
          userAccessLookups: {
            'stripe_subscription_id:sub_123': accessRow,
          },
        },
      )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(createStripeSubscriptionScheduleFromSubscription).toHaveBeenCalledWith({
      secretKey: 'sk_test',
      subscriptionId: 'sub_123',
    })
    expect(updateStripeSubscriptionSchedule).toHaveBeenCalledWith({
      priceId: 'price_installments',
      quantity: 1,
      scheduleId: 'sub_sched_123',
      secretKey: 'sk_test',
      startDate: 1712700000,
    })
    expect(service.userAccessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'active',
        revoked_at: null,
        status: 'active',
        stripe_payment_intent_id: 'pi_invoice_123',
        stripe_subscription_schedule_id: 'sub_sched_123',
      }),
    )
    expect(service.userAccessUpdateEq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('revokes installments access on invoice.payment_failed', async () => {
    const { handler, service } = createHandler(
      {
        id: 'evt_invoice_failed',
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_123',
            payment_intent: 'pi_fail_123',
            subscription: 'sub_123',
          },
        },
      },
      {
        userAccessLookups: {
          'stripe_subscription_id:sub_123': {
            billing_status: 'active',
            granted_at: '2026-04-10T12:00:00.000Z',
            plan_code: 'premium',
            purchase_option: 'installments_10',
            source_slug: 'nexora-hero',
            status: 'active',
            stripe_checkout_session_id: 'cs_123',
            stripe_customer_id: 'cus_123',
            stripe_payment_intent_id: 'pi_old',
            stripe_subscription_id: 'sub_123',
            stripe_subscription_schedule_id: 'sub_sched_123',
            user_id: 'user-123',
          },
        },
      },
    )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'delinquent',
        status: 'revoked',
        stripe_payment_intent_id: 'pi_fail_123',
      }),
    )
  })

  it('marks installments as completed when the schedule finishes', async () => {
    const { handler, service } = createHandler(
      {
        id: 'evt_schedule_completed',
        type: 'subscription_schedule.completed',
        data: {
          object: {
            id: 'sub_sched_123',
            subscription: 'sub_123',
          },
        },
      },
      {
        userAccessLookups: {
          'stripe_subscription_schedule_id:sub_sched_123': {
            billing_status: 'active',
            granted_at: '2026-04-10T12:00:00.000Z',
            plan_code: 'premium',
            purchase_option: 'installments_10',
            source_slug: 'nexora-hero',
            status: 'active',
            stripe_checkout_session_id: 'cs_123',
            stripe_customer_id: 'cus_123',
            stripe_payment_intent_id: 'pi_old',
            stripe_subscription_id: 'sub_123',
            stripe_subscription_schedule_id: 'sub_sched_123',
            user_id: 'user-123',
          },
        },
      },
    )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'completed',
        status: 'active',
      }),
    )
  })

  it('revokes installments access when the subscription is deleted before completion', async () => {
    const { handler, service } = createHandler(
      {
        id: 'evt_subscription_deleted',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_123',
            id: 'sub_123',
          },
        },
      },
      {
        userAccessLookups: {
          'stripe_subscription_id:sub_123': {
            billing_status: 'active',
            granted_at: '2026-04-10T12:00:00.000Z',
            plan_code: 'premium',
            purchase_option: 'installments_10',
            source_slug: 'nexora-hero',
            status: 'active',
            stripe_checkout_session_id: 'cs_123',
            stripe_customer_id: 'cus_123',
            stripe_payment_intent_id: 'pi_old',
            stripe_subscription_id: 'sub_123',
            stripe_subscription_schedule_id: 'sub_sched_123',
            user_id: 'user-123',
          },
        },
      },
    )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_status: 'canceled',
        status: 'revoked',
      }),
    )
  })

  it('does not revoke installments access if the subscription deletion happens after completion', async () => {
    const { handler, service } = createHandler(
      {
        id: 'evt_subscription_deleted_completed',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_123',
            id: 'sub_123',
          },
        },
      },
      {
        userAccessLookups: {
          'stripe_subscription_id:sub_123': {
            billing_status: 'completed',
            granted_at: '2026-04-10T12:00:00.000Z',
            plan_code: 'premium',
            purchase_option: 'installments_10',
            source_slug: 'nexora-hero',
            status: 'active',
            stripe_checkout_session_id: 'cs_123',
            stripe_customer_id: 'cus_123',
            stripe_payment_intent_id: 'pi_old',
            stripe_subscription_id: 'sub_123',
            stripe_subscription_schedule_id: 'sub_sched_123',
            user_id: 'user-123',
          },
        },
      },
    )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpdate).not.toHaveBeenCalled()
  })

  it('revokes premium access for refunded charges', async () => {
    const { handler, service } = createHandler(
      {
        id: 'evt_refund',
        type: 'charge.refunded',
        data: {
          object: {
            customer: 'cus_123',
            payment_intent: 'pi_123',
          },
        },
      },
      {
        userAccessLookups: {
          'stripe_payment_intent_id:pi_123': {
            billing_status: 'active',
            granted_at: '2026-04-10T12:00:00.000Z',
            plan_code: 'premium',
            purchase_option: 'one_time',
            source_slug: 'nexora-hero',
            status: 'active',
            stripe_checkout_session_id: 'cs_123',
            stripe_customer_id: 'cus_123',
            stripe_payment_intent_id: 'pi_123',
            stripe_subscription_id: null,
            stripe_subscription_schedule_id: null,
            user_id: 'user-123',
          },
        },
      },
    )

    const response = await handler(createStripeWebhookRequest())

    expect(response.status).toBe(200)
    expect(service.userAccessUpdateEq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(service.userAccessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'revoked',
      }),
    )
  })
})
