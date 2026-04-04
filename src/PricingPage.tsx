import { useEffect, useMemo, useRef, useState } from 'react'
import { createPremiumCheckoutSession, signInWithGoogle } from './auth/api'
import { hasActivePremiumAccess } from './auth/access'
import { usePremiumAccess } from './auth/usePremiumAccess'
import logoImage from './assets/logo.png'
import { assignBrowserLocation } from './lib/browserNavigation'

type FeatureItem = {
  label: string
  emphasis?: boolean
}

const CHECKOUT_INTENT = 'checkout'

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-1 h-4 w-4 shrink-0 text-[var(--foreground)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 10.5 8 14l7.5-8" />
    </svg>
  )
}

const freeBenefits: FeatureItem[] = [
  { label: 'Acesso aos cards free publicados' },
  { label: 'Preview animado de toda a vitrine' },
  { label: 'Copia imediata do markdown liberado' },
]

const premiumBenefits: FeatureItem[] = [
  { label: 'Tudo do plano Free', emphasis: true },
  { label: 'Acesso aos cards exclusivos marcados como premium' },
  { label: 'Pagamento unico com acesso vitalicio' },
]

function normalizeSourceSlug(value: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null
}

function hasCheckoutIntent(search: string) {
  return new URLSearchParams(search).get('intent') === CHECKOUT_INTENT
}

function buildPricingPath(sourceSlug: string | null, intent?: string | null) {
  const searchParams = new URLSearchParams()

  if (sourceSlug) {
    searchParams.set('from', sourceSlug)
  }

  if (intent) {
    searchParams.set('intent', intent)
  }

  const search = searchParams.toString()
  return search ? `/pricing/?${search}` : '/pricing/'
}

function FeatureList({ items }: { items: FeatureItem[] }) {
  return (
    <ul className="mt-8 space-y-3 text-left text-sm leading-6 text-[var(--secondary)]">
      {items.map((item) => (
        <li key={item.label} className="flex gap-3">
          <CheckIcon />
          <span className={item.emphasis ? 'font-semibold text-[var(--foreground)]' : undefined}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function PricingPage() {
  const { accessState, isLoading: isAccessLoading } = usePremiumAccess()
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [actionState, setActionState] = useState<'idle' | 'signing_in' | 'starting_checkout'>(
    'idle',
  )
  const autoCheckoutStartedRef = useRef(false)
  const sourceSlug = useMemo(
    () =>
      typeof window === 'undefined'
        ? null
        : normalizeSourceSlug(new URLSearchParams(window.location.search).get('from')),
    [],
  )
  const shouldContinueCheckout = useMemo(
    () => (typeof window === 'undefined' ? false : hasCheckoutIntent(window.location.search)),
    [],
  )
  const hasPremiumAccess = hasActivePremiumAccess(accessState)
  const isActionPending = isAccessLoading || actionState !== 'idle'
  const checkoutResumePath = useMemo(
    () => buildPricingPath(sourceSlug, CHECKOUT_INTENT),
    [sourceSlug],
  )

  async function startGoogleLogin() {
    setActionErrorMessage(null)
    setActionState('signing_in')

    try {
      await signInWithGoogle(checkoutResumePath)
    } catch (error) {
      console.error('Could not start Google sign in from pricing.', error)
      setActionErrorMessage('Nao foi possivel abrir o login agora.')
      setActionState('idle')
    }
  }

  async function startCheckout(options?: { clearIntentOnError?: boolean }) {
    setActionErrorMessage(null)
    setActionState('starting_checkout')

    try {
      const checkoutUrl = await createPremiumCheckoutSession(sourceSlug)
      assignBrowserLocation(checkoutUrl)
    } catch (error) {
      console.error('Could not start premium checkout.', error)

      if (options?.clearIntentOnError && typeof window !== 'undefined') {
        window.history.replaceState({}, '', buildPricingPath(sourceSlug))
      }

      setActionErrorMessage('Nao foi possivel iniciar o pagamento agora.')
      setActionState('idle')
    }
  }

  useEffect(() => {
    if (
      autoCheckoutStartedRef.current ||
      !shouldContinueCheckout ||
      isAccessLoading ||
      !accessState.isAuthenticated ||
      hasPremiumAccess
    ) {
      return
    }

    autoCheckoutStartedRef.current = true

    void (async () => {
      setActionErrorMessage(null)
      setActionState('starting_checkout')

      try {
        const checkoutUrl = await createPremiumCheckoutSession(sourceSlug)
        assignBrowserLocation(checkoutUrl)
      } catch (error) {
        console.error('Could not resume premium checkout.', error)
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', buildPricingPath(sourceSlug))
        }
        setActionErrorMessage('Nao foi possivel iniciar o pagamento agora.')
        setActionState('idle')
      }
    })()
  }, [
    accessState.isAuthenticated,
    hasPremiumAccess,
    isAccessLoading,
    shouldContinueCheckout,
    sourceSlug,
  ])

  async function handlePremiumAction() {
    if (isActionPending) {
      return
    }

    if (hasPremiumAccess) {
      assignBrowserLocation('/')
      return
    }

    if (!accessState.isAuthenticated) {
      await startGoogleLogin()
      return
    }

    await startCheckout()
  }

  const premiumCtaLabel = isAccessLoading
    ? 'Carregando...'
    : actionState === 'signing_in'
      ? 'Abrindo Google...'
      : actionState === 'starting_checkout'
        ? 'Abrindo pagamento...'
        : hasPremiumAccess
          ? 'Abrir catalogo premium'
          : accessState.isAuthenticated
            ? 'Ir para pagamento'
            : 'Entrar com Google'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.06),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(0,0,0,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(243,243,244,0.82)_44%,rgba(255,255,255,0.82)_100%)]" />
      <div className="pointer-events-none absolute left-[-10rem] top-[6rem] h-[20rem] w-[20rem] rounded-full bg-black/4 blur-3xl" />
      <div className="pointer-events-none absolute right-[-8rem] top-[20rem] h-[18rem] w-[18rem] rounded-full bg-black/6 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1320px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-[8px] px-5 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-4">
            <a href="/" className="flex items-center">
              <img
                src={logoImage}
                alt="Prompt Archive"
                draggable={false}
                className="h-7 w-auto object-contain sm:h-12"
              />
            </a>
            <a
              href="/"
              className="group inline-flex items-center gap-2 rounded-[8px] bg-[var(--surface-lowest)] px-4 py-2 text-sm font-medium text-[var(--foreground)] shadow-sm transition-all duration-300 hover:-translate-y-[2px] hover:bg-[var(--surface)] hover:shadow-md hover:ring-1 hover:ring-black/5 active:translate-y-0 active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-300 group-hover:-translate-x-1 group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Voltar ao catalogo
            </a>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto max-w-[52rem] text-center">
            <h1 className="mx-auto mt-6 max-w-[15ch] text-[clamp(2rem,8vw,5.5rem)] leading-[0.9] font-black tracking-[-0.07em]">
              PAGUE 1 VEZ
              <span className="block whitespace-nowrap tracking-normal">
                <span className="text-[#ff3b8a]">É</span>
                <span className="bg-gradient-to-r from-[#FF3B8A] via-[#9B51E0] to-[#2F80ED] bg-clip-text text-transparent">
                  {' SUA PRA SEMPRE'}
                </span>
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-[42rem] text-sm leading-6 text-[var(--secondary)] sm:text-base">
              Como os planos de assinatura podem ser instaveis, oferecemos
              apenas planos vitalicios, ideais para freelancers, designers
              individuais e pequenas equipes.
            </p>
          </div>

          <div className="mx-auto mt-12 w-full max-w-[980px] rounded-[8px] bg-[var(--surface-low)] p-3 sm:p-4 lg:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
              <section className="flex h-full flex-col rounded-[8px] bg-[var(--surface-lowest)] px-6 py-7 text-center sm:px-7 sm:py-8 lg:px-8 lg:py-10">
                <div className="flex flex-col items-center">
                  <h2 className="text-[2rem] leading-[0.95] font-black tracking-[-0.06em]">
                    Free
                  </h2>
                  <p className="mt-4 max-w-[24rem] text-sm leading-6 text-[var(--secondary)] md:min-h-[6.5rem]">
                    Entrada livre para explorar a vitrine, assistir aos previews
                    e copiar tudo o que continuar aberto para visitantes.
                  </p>
                  <p className="mt-6 text-[3.15rem] leading-none font-black tracking-[-0.08em]">
                    R$ 0
                  </p>
                </div>

                <a
                  href="/"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-[8px] bg-[var(--surface-low)] px-5 py-3.5 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-high)]"
                >
                  Continuar no catalogo
                </a>

                <FeatureList items={freeBenefits} />
              </section>

              <section className="flex h-full flex-col rounded-[8px] bg-[var(--surface-lowest)] px-6 py-7 text-center shadow-[0_24px_48px_rgba(0,0,0,0.06)] sm:px-7 sm:py-8 lg:px-8 lg:py-10">
                <div className="flex flex-col items-center">
                  <h2 className="bg-gradient-to-r from-[#FF3B8A] via-[#9B51E0] to-[#2F80ED] bg-clip-text text-[2rem] leading-[0.95] font-black tracking-[-0.06em] text-transparent">
                    Premium
                  </h2>
                  <p className="mt-4 max-w-[28rem] text-sm leading-6 text-[var(--secondary)] md:min-h-[6.5rem]">
                    O upgrade concentra tudo o que ja esta livre e abre os cards
                    exclusivos do acervo em um pagamento unico.
                  </p>
                  <p className="mt-6 text-[3.15rem] leading-none font-black tracking-[-0.08em]">
                    R$ 59,90
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handlePremiumAction()
                  }}
                  disabled={isActionPending}
                  className="mt-8 inline-flex w-full items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92 disabled:cursor-wait disabled:opacity-70"
                >
                  {premiumCtaLabel}
                </button>

                {actionErrorMessage ? (
                  <p className="mt-4 text-sm text-[#8f1d1d]">{actionErrorMessage}</p>
                ) : null}

                <FeatureList items={premiumBenefits} />
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
