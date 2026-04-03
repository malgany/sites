import { getRequiredEnv } from '../_shared/env.ts'
import { verifyStripeWebhookEvent } from '../_shared/stripe.ts'
import { createServiceClient } from '../_shared/supabase.ts'
import { createStripeWebhookHandler } from './handler.ts'

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

Deno.serve(
  createStripeWebhookHandler({
    createServiceClient,
    getRequiredEnv,
    verifyStripeWebhookEvent,
  }),
)
