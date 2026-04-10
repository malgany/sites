import { jsonResponse, handleCorsPreflightRequest } from '../_shared/http.ts'
import type { StripePurchaseOption, StripeWebhookEvent } from '../_shared/stripe.ts'
import type { ServiceClient } from '../_shared/types.ts'

type UserAccessRow = {
  billing_status: 'pending' | 'active' | 'delinquent' | 'completed' | 'canceled' | null
  granted_at: string | null
  plan_code: 'premium' | null
  purchase_option: StripePurchaseOption | null
  status: 'pending' | 'active' | 'revoked' | null
  stripe_checkout_session_id: string | null
  stripe_customer_id: string | null
  stripe_payment_intent_id: string | null
  stripe_subscription_id: string | null
  stripe_subscription_schedule_id: string | null
  source_slug: string | null
  user_id: string
}

type StripeWebhookDeps = {
  createServiceClient: () => ServiceClient
  createStripeSubscriptionScheduleFromSubscription: (options: {
    secretKey: string
    subscriptionId: string
  }) => Promise<{ id: string }>
  getRequiredEnv: (name: string) => string
  updateStripeSubscriptionSchedule: (options: {
    priceId: string
    quantity?: number
    scheduleId: string
    secretKey: string
    startDate: number | string
  }) => Promise<{ id: string }>
  verifyStripeWebhookEvent: (options: {
    requestBody: string
    signatureHeader: string
    webhookSecret: string
  }) => Promise<StripeWebhookEvent>
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getObjectValue(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function getArrayValue(value: unknown) {
  return Array.isArray(value) ? value : null
}

function getPurchaseOption(value: unknown): StripePurchaseOption {
  return value === 'installments_10' ? 'installments_10' : 'one_time'
}

function getFirstInvoiceLine(invoice: Record<string, unknown>) {
  const lines = getObjectValue(invoice.lines)
  const data = getArrayValue(lines?.data)
  return data && data.length > 0 ? getObjectValue(data[0]) : null
}

async function lookupUserAccessByColumn(
  serviceClient: ServiceClient,
  column: string,
  value: string | null,
) {
  if (!value) {
    return null
  }

  const lookup = await serviceClient
    .from<UserAccessRow>('user_access')
    .select(
      'billing_status, granted_at, plan_code, purchase_option, source_slug, status, stripe_checkout_session_id, stripe_customer_id, stripe_payment_intent_id, stripe_subscription_id, stripe_subscription_schedule_id, user_id',
    )
    .eq(column, value)
    .maybeSingle()

  if (lookup.error) {
    throw new Error(lookup.error.message)
  }

  return lookup.data
}

async function findUserAccessForInvoice(
  serviceClient: ServiceClient,
  invoice: Record<string, unknown>,
) {
  const subscriptionId = getStringValue(invoice.subscription)
  const customerId = getStringValue(invoice.customer)

  return (
    (await lookupUserAccessByColumn(serviceClient, 'stripe_subscription_id', subscriptionId)) ??
    (await lookupUserAccessByColumn(serviceClient, 'stripe_customer_id', customerId))
  )
}

async function findUserAccessForScheduleLikeObject(
  serviceClient: ServiceClient,
  object: Record<string, unknown>,
) {
  const objectId = getStringValue(object.id)
  const scheduleId = objectId
  const subscriptionId = getStringValue(object.subscription) ?? objectId
  const customerId = getStringValue(object.customer)

  return (
    (await lookupUserAccessByColumn(
      serviceClient,
      'stripe_subscription_schedule_id',
      scheduleId,
    )) ??
    (await lookupUserAccessByColumn(serviceClient, 'stripe_subscription_id', subscriptionId)) ??
    (await lookupUserAccessByColumn(serviceClient, 'stripe_customer_id', customerId))
  )
}

async function findUserAccessForRefundLikeObject(
  serviceClient: ServiceClient,
  object: Record<string, unknown>,
) {
  const paymentIntentId = getStringValue(object.payment_intent)
  const customerId = getStringValue(object.customer)

  return (
    (await lookupUserAccessByColumn(
      serviceClient,
      'stripe_payment_intent_id',
      paymentIntentId,
    )) ??
    (await lookupUserAccessByColumn(serviceClient, 'stripe_customer_id', customerId))
  )
}

async function updateUserAccessByUserId(
  serviceClient: ServiceClient,
  userId: string,
  values: Record<string, unknown>,
) {
  const updateResult = await serviceClient.from('user_access').update(values).eq('user_id', userId)

  if (updateResult.error) {
    throw new Error(updateResult.error.message)
  }
}

async function upsertUserAccess(
  serviceClient: ServiceClient,
  values: Record<string, unknown>,
) {
  const accessUpsert = await serviceClient.from('user_access').upsert(values, {
    onConflict: 'user_id',
  })

  if (accessUpsert.error) {
    throw new Error(accessUpsert.error.message)
  }
}

async function handleCheckoutSessionCompleted(
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  const checkoutSession = getObjectValue(event.data.object)
  const metadata = getObjectValue(checkoutSession?.metadata)
  const userId =
    getStringValue(checkoutSession?.client_reference_id) ||
    getStringValue(metadata?.user_id)

  if (!userId) {
    throw new Error('Stripe checkout session is missing a user reference.')
  }

  const existingAccess = await lookupUserAccessByColumn(serviceClient, 'user_id', userId)
  const purchaseOption = getPurchaseOption(metadata?.purchase_option)
  const customerId = getStringValue(checkoutSession?.customer)
  const paymentIntentId = getStringValue(checkoutSession?.payment_intent)
  const sourceSlug = getStringValue(metadata?.source_slug) ?? existingAccess?.source_slug ?? null

  if (purchaseOption === 'installments_10') {
    const subscriptionId = getStringValue(checkoutSession?.subscription)

    if (!subscriptionId) {
      throw new Error('Installments checkout session is missing a subscription id.')
    }

    const billingStatus =
      existingAccess?.billing_status === 'active' || existingAccess?.billing_status === 'completed'
        ? existingAccess.billing_status
        : 'pending'
    const status =
      existingAccess?.status === 'active' || billingStatus === 'completed'
        ? 'active'
        : 'pending'

    await upsertUserAccess(serviceClient, {
      billing_status: billingStatus,
      granted_at: status === 'active' ? existingAccess?.granted_at ?? new Date().toISOString() : null,
      plan_code: 'premium',
      purchase_option: 'installments_10',
      revoked_at: null,
      source_slug: sourceSlug,
      status,
      stripe_checkout_session_id: getStringValue(checkoutSession?.id),
      stripe_customer_id: customerId,
      stripe_payment_intent_id: paymentIntentId ?? existingAccess?.stripe_payment_intent_id ?? null,
      stripe_subscription_id: subscriptionId,
      stripe_subscription_schedule_id: existingAccess?.stripe_subscription_schedule_id ?? null,
      user_id: userId,
    })
    return
  }

  await upsertUserAccess(serviceClient, {
    billing_status: 'active',
    granted_at: new Date().toISOString(),
    plan_code: 'premium',
    purchase_option: 'one_time',
    revoked_at: null,
    source_slug: sourceSlug,
    status: 'active',
    stripe_checkout_session_id: getStringValue(checkoutSession?.id),
    stripe_customer_id: customerId,
    stripe_payment_intent_id: paymentIntentId,
    stripe_subscription_id: null,
    stripe_subscription_schedule_id: null,
    user_id: userId,
  })
}

async function handleInvoicePaid(
  deps: StripeWebhookDeps,
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  const invoice = getObjectValue(event.data.object)

  if (!invoice) {
    return
  }

  const accessRow = await findUserAccessForInvoice(serviceClient, invoice)

  if (!accessRow || accessRow.purchase_option !== 'installments_10') {
    return
  }

  const subscriptionId = getStringValue(invoice.subscription)

  if (!subscriptionId) {
    throw new Error('Invoice paid event is missing a subscription id.')
  }

  const invoiceLine = getFirstInvoiceLine(invoice)
  const linePrice = getObjectValue(invoiceLine?.price)
  const linePeriod = getObjectValue(invoiceLine?.period)
  const priceId = getStringValue(linePrice?.id)
  const startDate = getNumberValue(linePeriod?.start)
  const quantity = getNumberValue(invoiceLine?.quantity) ?? 1
  const customerId = getStringValue(invoice.customer)
  const paymentIntentId = getStringValue(invoice.payment_intent)

  if (!priceId || !startDate) {
    throw new Error('Invoice paid event is missing schedule pricing details.')
  }

  let scheduleId = accessRow.stripe_subscription_schedule_id

  if (!scheduleId) {
    const secretKey = deps.getRequiredEnv('STRIPE_SECRET_KEY')
    const schedule = await deps.createStripeSubscriptionScheduleFromSubscription({
      secretKey,
      subscriptionId,
    })

    await deps.updateStripeSubscriptionSchedule({
      priceId,
      quantity,
      scheduleId: schedule.id,
      secretKey,
      startDate,
    })
    scheduleId = schedule.id
  }

  await updateUserAccessByUserId(serviceClient, accessRow.user_id, {
    billing_status: 'active',
    granted_at: accessRow.granted_at ?? new Date().toISOString(),
    revoked_at: null,
    status: 'active',
    stripe_customer_id: customerId ?? accessRow.stripe_customer_id,
    stripe_payment_intent_id: paymentIntentId ?? accessRow.stripe_payment_intent_id,
    stripe_subscription_id: subscriptionId,
    stripe_subscription_schedule_id: scheduleId,
  })
}

async function handleInvoicePaymentFailed(
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  const invoice = getObjectValue(event.data.object)

  if (!invoice) {
    return
  }

  const accessRow = await findUserAccessForInvoice(serviceClient, invoice)

  if (!accessRow || accessRow.purchase_option !== 'installments_10') {
    return
  }

  await updateUserAccessByUserId(serviceClient, accessRow.user_id, {
    billing_status: 'delinquent',
    revoked_at: new Date().toISOString(),
    status: 'revoked',
    stripe_customer_id: getStringValue(invoice.customer) ?? accessRow.stripe_customer_id,
    stripe_payment_intent_id:
      getStringValue(invoice.payment_intent) ?? accessRow.stripe_payment_intent_id,
    stripe_subscription_id: getStringValue(invoice.subscription) ?? accessRow.stripe_subscription_id,
  })
}

async function handleSubscriptionScheduleCompleted(
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  const schedule = getObjectValue(event.data.object)

  if (!schedule) {
    return
  }

  const accessRow = await findUserAccessForScheduleLikeObject(serviceClient, schedule)

  if (!accessRow) {
    return
  }

  await updateUserAccessByUserId(serviceClient, accessRow.user_id, {
    billing_status: 'completed',
    revoked_at: null,
    status: 'active',
    stripe_subscription_schedule_id: getStringValue(schedule.id) ?? accessRow.stripe_subscription_schedule_id,
    stripe_subscription_id: getStringValue(schedule.subscription) ?? accessRow.stripe_subscription_id,
  })
}

async function handleCanceledInstallmentsAccess(
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  const subscriptionLikeObject = getObjectValue(event.data.object)

  if (!subscriptionLikeObject) {
    return
  }

  const accessRow = await findUserAccessForScheduleLikeObject(serviceClient, subscriptionLikeObject)

  if (!accessRow || accessRow.purchase_option !== 'installments_10') {
    return
  }

  if (accessRow.billing_status === 'completed') {
    return
  }

  await updateUserAccessByUserId(serviceClient, accessRow.user_id, {
    billing_status: 'canceled',
    revoked_at: new Date().toISOString(),
    status: 'revoked',
    stripe_customer_id:
      getStringValue(subscriptionLikeObject.customer) ?? accessRow.stripe_customer_id,
    stripe_subscription_id:
      getStringValue(subscriptionLikeObject.id) ??
      getStringValue(subscriptionLikeObject.subscription) ??
      accessRow.stripe_subscription_id,
    stripe_subscription_schedule_id:
      event.type === 'subscription_schedule.aborted'
        ? getStringValue(subscriptionLikeObject.id) ?? accessRow.stripe_subscription_schedule_id
        : accessRow.stripe_subscription_schedule_id,
  })
}

async function revokePremiumAccess(
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  const chargeLikeObject = getObjectValue(event.data.object)

  if (!chargeLikeObject) {
    return
  }

  const accessRow = await findUserAccessForRefundLikeObject(serviceClient, chargeLikeObject)

  if (!accessRow) {
    return
  }

  await updateUserAccessByUserId(serviceClient, accessRow.user_id, {
    billing_status:
      accessRow.purchase_option === 'installments_10'
        ? 'canceled'
        : accessRow.billing_status ?? 'canceled',
    revoked_at: new Date().toISOString(),
    status: 'revoked',
  })
}

async function processStripeEvent(
  deps: StripeWebhookDeps,
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(serviceClient, event)
      return
    case 'invoice.paid':
      await handleInvoicePaid(deps, serviceClient, event)
      return
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(serviceClient, event)
      return
    case 'subscription_schedule.completed':
      await handleSubscriptionScheduleCompleted(serviceClient, event)
      return
    case 'customer.subscription.deleted':
    case 'subscription_schedule.aborted':
      await handleCanceledInstallmentsAccess(serviceClient, event)
      return
    case 'refund.created':
    case 'charge.dispute.created':
    case 'charge.refunded':
      await revokePremiumAccess(serviceClient, event)
      return
    default:
      return
  }
}

export function createStripeWebhookHandler(deps: StripeWebhookDeps) {
  return async function handleStripeWebhook(request: Request) {
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
      const signatureHeader = request.headers.get('stripe-signature')

      if (!signatureHeader) {
        return jsonResponse(400, {
          error: 'Missing Stripe signature header.',
        })
      }

      const requestBody = await request.text()
      const event = await deps.verifyStripeWebhookEvent({
        requestBody,
        signatureHeader,
        webhookSecret: deps.getRequiredEnv('STRIPE_WEBHOOK_SECRET'),
      })
      const serviceClient = deps.createServiceClient()
      const eventLookup = await serviceClient
        .from('stripe_webhook_events')
        .select('processed_at')
        .eq('event_id', event.id)
        .maybeSingle()

      if (eventLookup.error) {
        throw new Error(eventLookup.error.message)
      }

      if (eventLookup.data?.processed_at) {
        return jsonResponse(200, {
          duplicate: true,
          received: true,
        })
      }

      const eventUpsert = await serviceClient.from('stripe_webhook_events').upsert(
        {
          event_id: event.id,
          event_type: event.type,
          payload: event,
        },
        {
          onConflict: 'event_id',
        },
      )

      if (eventUpsert.error) {
        throw new Error(eventUpsert.error.message)
      }

      await processStripeEvent(deps, serviceClient, event)

      const processedEventUpdate = await serviceClient
        .from('stripe_webhook_events')
        .update({
          processed_at: new Date().toISOString(),
        })
        .eq('event_id', event.id)

      if (processedEventUpdate.error) {
        throw new Error(processedEventUpdate.error.message)
      }

      return jsonResponse(200, {
        received: true,
      })
    } catch (error) {
      console.error('Could not process Stripe webhook.', error)
      return jsonResponse(400, {
        error:
          error instanceof Error
            ? error.message
            : 'Could not process Stripe webhook.',
      })
    }
  }
}
