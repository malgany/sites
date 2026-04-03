import { getRequiredEnv } from '../_shared/env.ts'
import {
  createStripeCheckoutSession,
  createStripeCustomer,
} from '../_shared/stripe.ts'
import { createServiceClient, createUserClient } from '../_shared/supabase.ts'
import { createCreateCheckoutSessionHandler } from './handler.ts'

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

Deno.serve(
  createCreateCheckoutSessionHandler({
    createServiceClient,
    createStripeCheckoutSession,
    createStripeCustomer,
    createUserClient,
    getRequiredEnv,
  }),
)
