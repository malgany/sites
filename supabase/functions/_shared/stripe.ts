type StripeApiOptions = {
  body?: URLSearchParams
  method?: 'GET' | 'POST'
}

type StripeCustomer = {
  id: string
}

type StripeCheckoutSession = {
  id: string
  url: string | null
}

type StripeSubscriptionSchedule = {
  id: string
}

export type StripeWebhookEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

export type StripePurchaseOption = 'one_time' | 'installments_10'

function stripTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function hexEncode(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}

async function createHmacSignature(secret: string, payload: string) {
  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  )
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    new TextEncoder().encode(payload),
  )

  return hexEncode(signatureBuffer)
}

async function callStripeApi<T>(
  secretKey: string,
  path: string,
  { body, method = 'POST' }: StripeApiOptions = {},
) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method,
  })
  const payload = (await response.json()) as Record<string, unknown>

  if (!response.ok) {
    const message =
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'message' in payload.error &&
      typeof (payload.error as Record<string, unknown>).message === 'string'
        ? (payload.error as Record<string, unknown>).message as string
        : `Stripe request failed with status ${response.status}: ${JSON.stringify(payload)}`

    throw new Error(message)
  }

  return payload as T
}

export async function createStripeCustomer(options: {
  email: string
  secretKey: string
  userId: string
}) {
  const formData = new URLSearchParams()
  formData.set('email', options.email)
  formData.set('metadata[user_id]', options.userId)

  return callStripeApi<StripeCustomer>(options.secretKey, '/v1/customers', {
    body: formData,
  })
}

export async function createStripeCheckoutSession(options: {
  customerId: string
  purchaseOption: StripePurchaseOption
  priceId: string
  secretKey: string
  siteUrl: string
  sourceSlug: string | null
  userId: string
}) {
  const siteUrl = stripTrailingSlash(options.siteUrl)
  const successUrl = new URL('/payment-success/', `${siteUrl}/`)
  const cancelUrl = new URL('/pricing/', `${siteUrl}/`)
  const formData = new URLSearchParams()
  const mode = options.purchaseOption === 'installments_10' ? 'subscription' : 'payment'

  if (options.sourceSlug) {
    successUrl.searchParams.set('source_slug', options.sourceSlug)
    cancelUrl.searchParams.set('from', options.sourceSlug)
    formData.set('metadata[source_slug]', options.sourceSlug)
  }

  successUrl.searchParams.set('purchase_option', options.purchaseOption)
  cancelUrl.searchParams.set('purchase_option', options.purchaseOption)
  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}')

  formData.set('allow_promotion_codes', 'true')
  formData.set('cancel_url', cancelUrl.toString())
  formData.set('client_reference_id', options.userId)
  formData.set('customer', options.customerId)
  formData.set('line_items[0][price]', options.priceId)
  formData.set('line_items[0][quantity]', '1')
  formData.set('locale', 'pt-BR')
  formData.set('metadata[plan_code]', 'premium')
  formData.set('metadata[purchase_option]', options.purchaseOption)
  formData.set('metadata[user_id]', options.userId)
  formData.set('mode', mode)
  if (mode === 'payment') {
    formData.set('submit_type', 'pay')
  }
  formData.set('success_url', successUrl.toString())

  if (mode === 'subscription') {
    formData.set('subscription_data[metadata][plan_code]', 'premium')
    formData.set('subscription_data[metadata][purchase_option]', options.purchaseOption)
    formData.set('subscription_data[metadata][user_id]', options.userId)

    if (options.sourceSlug) {
      formData.set('subscription_data[metadata][source_slug]', options.sourceSlug)
    }
  }

  return callStripeApi<StripeCheckoutSession>(
    options.secretKey,
    '/v1/checkout/sessions',
    {
      body: formData,
    },
  )
}

export async function createStripeSubscriptionScheduleFromSubscription(options: {
  secretKey: string
  subscriptionId: string
}) {
  const formData = new URLSearchParams()
  formData.set('from_subscription', options.subscriptionId)

  return callStripeApi<StripeSubscriptionSchedule>(
    options.secretKey,
    '/v1/subscription_schedules',
    {
      body: formData,
    },
  )
}

export async function updateStripeSubscriptionSchedule(options: {
  priceId: string
  quantity?: number
  scheduleId: string
  secretKey: string
  startDate: number | string
}) {
  const formData = new URLSearchParams()
  formData.set('end_behavior', 'cancel')
  formData.set('phases[0][start_date]', String(options.startDate))
  formData.set('phases[0][items][0][price]', options.priceId)
  formData.set('phases[0][items][0][quantity]', String(options.quantity ?? 1))
  formData.set('phases[0][duration][interval]', 'month')
  formData.set('phases[0][duration][interval_count]', '10')

  return callStripeApi<StripeSubscriptionSchedule>(
    options.secretKey,
    `/v1/subscription_schedules/${options.scheduleId}`,
    {
      body: formData,
    },
  )
}

export async function verifyStripeWebhookEvent(options: {
  requestBody: string
  signatureHeader: string
  toleranceSeconds?: number
  webhookSecret: string
}) {
  const signatureParts = options.signatureHeader
    .split(',')
    .map((part) => part.trim())
  const timestamp = signatureParts
    .find((part) => part.startsWith('t='))
    ?.slice(2)
  const v1Signatures = signatureParts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))

  if (!timestamp || v1Signatures.length === 0) {
    throw new Error('Missing Stripe signature fields.')
  }

  const toleranceSeconds = options.toleranceSeconds ?? 300
  const timestampNumber = Number(timestamp)

  if (!Number.isFinite(timestampNumber)) {
    throw new Error('Invalid Stripe signature timestamp.')
  }

  if (Math.abs(Date.now() / 1000 - timestampNumber) > toleranceSeconds) {
    throw new Error('Expired Stripe signature timestamp.')
  }

  const signedPayload = `${timestamp}.${options.requestBody}`
  const expectedSignature = await createHmacSignature(
    options.webhookSecret,
    signedPayload,
  )

  if (!v1Signatures.some((signature) => timingSafeEqual(signature, expectedSignature))) {
    throw new Error('Invalid Stripe webhook signature.')
  }

  return JSON.parse(options.requestBody) as StripeWebhookEvent
}
