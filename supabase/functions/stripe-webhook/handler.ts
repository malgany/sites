import { jsonResponse, handleCorsPreflightRequest } from '../_shared/http.ts'
import type { StripeWebhookEvent } from '../_shared/stripe.ts'
import type { ServiceClient } from '../_shared/types.ts'

type StripeWebhookDeps = {
  createServiceClient: () => ServiceClient
  getRequiredEnv: (name: string) => string
  verifyStripeWebhookEvent: (options: {
    requestBody: string
    signatureHeader: string
    webhookSecret: string
  }) => Promise<StripeWebhookEvent>
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getObjectValue(value: unknown) {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

async function activatePremiumAccess(serviceClient: ServiceClient, event: StripeWebhookEvent) {
  const checkoutSession = getObjectValue(event.data.object)
  const metadata = getObjectValue(checkoutSession?.metadata)
  const userId =
    getStringValue(checkoutSession?.client_reference_id) ||
    getStringValue(metadata?.user_id)

  if (!userId) {
    throw new Error('Stripe checkout session is missing a user reference.')
  }

  const accessUpsert = await serviceClient.from('user_access').upsert(
    {
      granted_at: new Date().toISOString(),
      plan_code: 'premium',
      revoked_at: null,
      source_slug: getStringValue(metadata?.source_slug),
      status: 'active',
      stripe_checkout_session_id: getStringValue(checkoutSession?.id),
      stripe_customer_id: getStringValue(checkoutSession?.customer),
      stripe_payment_intent_id: getStringValue(checkoutSession?.payment_intent),
      user_id: userId,
    },
    {
      onConflict: 'user_id',
    },
  )

  if (accessUpsert.error) {
    throw new Error(accessUpsert.error.message)
  }
}

async function revokePremiumAccess(serviceClient: ServiceClient, event: StripeWebhookEvent) {
  const chargeLikeObject = getObjectValue(event.data.object)
  const paymentIntentId = getStringValue(chargeLikeObject?.payment_intent)
  const customerId = getStringValue(chargeLikeObject?.customer)

  if (!paymentIntentId && !customerId) {
    return
  }

  let query = serviceClient.from('user_access').update({
    revoked_at: new Date().toISOString(),
    status: 'revoked',
  })

  query = paymentIntentId
    ? query.eq('stripe_payment_intent_id', paymentIntentId)
    : query.eq('stripe_customer_id', customerId)

  const updateResult = await query

  if (updateResult.error) {
    throw new Error(updateResult.error.message)
  }
}

async function processStripeEvent(
  serviceClient: ServiceClient,
  event: StripeWebhookEvent,
) {
  switch (event.type) {
    case 'checkout.session.completed':
      await activatePremiumAccess(serviceClient, event)
      return
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

      await processStripeEvent(serviceClient, event)

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
