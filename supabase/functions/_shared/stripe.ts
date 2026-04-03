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

export type StripeWebhookEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

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
      typeof payload.error.message === 'string'
        ? payload.error.message
        : `Stripe request failed with status ${response.status}.`

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

  if (options.sourceSlug) {
    successUrl.searchParams.set('source_slug', options.sourceSlug)
    cancelUrl.searchParams.set('from', options.sourceSlug)
    formData.set('metadata[source_slug]', options.sourceSlug)
  }

  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}')

  formData.set('allow_promotion_codes', 'true')
  formData.set('cancel_url', cancelUrl.toString())
  formData.set('client_reference_id', options.userId)
  formData.set('customer', options.customerId)
  formData.set('line_items[0][price]', options.priceId)
  formData.set('line_items[0][quantity]', '1')
  formData.set('metadata[plan_code]', 'premium')
  formData.set('metadata[user_id]', options.userId)
  formData.set('mode', 'payment')
  formData.set('success_url', successUrl.toString())

  return callStripeApi<StripeCheckoutSession>(
    options.secretKey,
    '/v1/checkout/sessions',
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
