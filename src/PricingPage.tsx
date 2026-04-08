import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { createPremiumCheckoutSession, signInWithGoogle } from './auth/api'
import { hasActivePremiumAccess } from './auth/access'
import { usePremiumAccess } from './auth/usePremiumAccess'
import logoImage from './assets/logo.png'
import { loadCachedCatalog, storeCachedCatalog } from './catalog/cache'
import { refreshCatalogMetadata } from './catalog/repository'
import { assignBrowserLocation } from './lib/browserNavigation'
import { getCatalogOfferStats } from './lib/catalogOfferStats'
import { trackMetaEvent } from './lib/metaPixel'
import type { CatalogCardItem } from './types'

type FeatureItem = {
  label: string
  emphasis?: boolean
}

type FaqItem = {
  answer: string
  question: string
}

const CHECKOUT_INTENT = 'checkout'
const META_PIXEL_REDIRECT_DELAY_MS = 150

const freeBenefits: FeatureItem[] = [
  { label: 'Explore a vitrine e veja previews antes de comprar' },
  { label: 'Entenda o formato dos prompts e teste a proposta' },
  { label: 'Use o free como amostra, não como acervo completo' },
]

const premiumBenefits: FeatureItem[] = [
  { label: 'Prompts premium para SaaS, AI, Agency, Hero, Pricing e CTA', emphasis: true },
  { label: 'Mais repertório para estruturar layout, copy e direção visual' },
  { label: 'Pensado para projetos próprios e de clientes' },
  { label: 'Pagamento único com acesso vitalício' },
]

const proofPoints = [
  'Para devs e designers que querem acelerar páginas React + Tailwind.',
  'Para quem já sabe o que quer construir, mas não quer sair do zero toda vez.',
  'Para transformar exploração visual em execução mais rápida.',
]

const faqItems: readonly FaqItem[] = [
  {
    question: 'O que exatamente eu recebo ao comprar?',
    answer:
      'Você recebe acesso ao acervo premium de prompts estruturados do catálogo. O foco é acelerar a criação de páginas e seções em React + Tailwind com mais clareza de estrutura, copy e direção visual.',
  },
  {
    question: 'Isso é código pronto?',
    answer:
      'Não. O produto não é uma biblioteca plug-and-play de componentes finais. São prompts organizados para guiar a geração e adaptação do resultado no seu fluxo de trabalho.',
  },
  {
    question: 'Como uso esses prompts no meu fluxo?',
    answer:
      'Você explora o catálogo, escolhe um prompt, copia o conteúdo e usa no seu processo com Claude, ChatGPT ou outra IA para montar e iterar a página que precisa.',
  },
  {
    question: 'Isso serve para projetos React + Tailwind?',
    answer:
      'Sim. A oferta é posicionada para páginas e seções nesse stack, com foco em landing pages, heroes, pricing, CTAs e variações comuns de produtos digitais.',
  },
  {
    question: 'O pagamento é único?',
    answer:
      'Sim. O acesso é vitalício e o pagamento acontece uma vez, sem mensalidade recorrente.',
  },
]

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

function waitForMetaPixelFlush() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, META_PIXEL_REDIRECT_DELAY_MS)
  })
}

function FeatureList({ items }: { items: readonly FeatureItem[] }) {
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
  const [catalogItems, setCatalogItems] = useState<CatalogCardItem[]>(() => loadCachedCatalog())
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
  const catalogOfferStats = getCatalogOfferStats(catalogItems)

  useEffect(() => {
    let isCancelled = false

    void (async () => {
      try {
        const items = await refreshCatalogMetadata()

        if (isCancelled) {
          return
        }

        storeCachedCatalog(items)
        startTransition(() => {
          setCatalogItems(items)
        })
      } catch (error) {
        console.error('Could not refresh catalog stats for pricing.', error)
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [])

  async function startGoogleLogin() {
    setActionErrorMessage(null)
    setActionState('signing_in')

    try {
      await signInWithGoogle(checkoutResumePath)
    } catch (error) {
      console.error('Could not start Google sign in from pricing.', error)
      setActionErrorMessage('Não foi possível abrir o login agora.')
      setActionState('idle')
    }
  }

  async function startCheckout(options?: { clearIntentOnError?: boolean }) {
    setActionErrorMessage(null)
    setActionState('starting_checkout')

    try {
      const checkoutUrl = await createPremiumCheckoutSession(sourceSlug)
      trackMetaEvent('InitiateCheckout', { currency: 'BRL', value: 59.9, num_items: 1 })
      await waitForMetaPixelFlush()
      assignBrowserLocation(checkoutUrl)
    } catch (error) {
      console.error('Could not start premium checkout.', error)

      if (options?.clearIntentOnError && typeof window !== 'undefined') {
        window.history.replaceState({}, '', buildPricingPath(sourceSlug))
      }

      setActionErrorMessage('Não foi possível iniciar o pagamento agora.')
      setActionState('idle')
    }
  }

  useEffect(() => {
    trackMetaEvent('ViewContent', {
      content_name: 'Plano Premium',
      content_type: 'product',
      value: 59.9,
      currency: 'BRL',
    })
  }, [])

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
        trackMetaEvent('InitiateCheckout', { currency: 'BRL', value: 59.9, num_items: 1 })
        await waitForMetaPixelFlush()
        assignBrowserLocation(checkoutUrl)
      } catch (error) {
        console.error('Could not resume premium checkout.', error)
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', buildPricingPath(sourceSlug))
        }
        setActionErrorMessage('Não foi possível iniciar o pagamento agora.')
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
          ? 'Abrir catálogo premium'
          : 'Comprar acesso vitalício'

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
              Voltar ao catálogo
            </a>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mx-auto max-w-[56rem] text-center">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-[var(--secondary)]">
              React + Tailwind sem mensalidade
            </p>
            <h1 className="mx-auto mt-5 max-w-[12ch] text-[clamp(2.2rem,8vw,5.2rem)] leading-[0.9] font-black tracking-[-0.07em]">
              Pague uma vez
              <span className="block bg-gradient-to-r from-[#FF3B8A] via-[#9B51E0] to-[#2F80ED] bg-clip-text text-transparent">
                Tenha acesso vitalício
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-[44rem] text-sm leading-6 text-[var(--secondary)] sm:text-base">
              Destrave o acervo premium de prompts para React + Tailwind e
              acelere a criação de páginas e seções sem mensalidade.
            </p>

            {catalogOfferStats.totalCount > 0 ? (
              <div className="mx-auto mt-6 flex max-w-[52rem] flex-wrap items-center justify-center gap-2 text-left text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--secondary)] sm:text-xs">
                <span className="rounded-full bg-[var(--surface-low)] px-3 py-2 text-[var(--foreground)]">
                  {catalogOfferStats.totalCount} prompts prontos para React + Tailwind
                </span>
                <span className="rounded-full bg-[var(--surface-low)] px-3 py-2">
                  {catalogOfferStats.premiumCount} prompts premium exclusivos
                </span>
                <span className="rounded-full bg-[var(--surface-low)] px-3 py-2">
                  {catalogOfferStats.freeCount} exemplos livres para explorar antes de comprar
                </span>
              </div>
            ) : null}
          </div>

          <div className="mx-auto mt-12 w-full max-w-[980px] rounded-[8px] bg-[var(--surface-low)] p-3 sm:p-4 lg:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
              <section className="flex h-full flex-col rounded-[8px] bg-[var(--surface-lowest)] px-6 py-7 text-center sm:px-7 sm:py-8 lg:px-8 lg:py-10">
                <div className="flex flex-col items-center">
                  <h2 className="text-[2rem] leading-[0.95] font-black tracking-[-0.06em]">
                    Free
                  </h2>
                  <p className="mt-4 max-w-[24rem] text-sm leading-6 text-[var(--secondary)] md:min-h-[6.5rem]">
                    Use o free como amostra para explorar a vitrine, ver previews
                    e entender como os prompts funcionam antes da compra.
                  </p>
                  <p className="mt-6 text-[3.15rem] leading-none font-black tracking-[-0.08em]">
                    R$ 0
                  </p>
                </div>

                <a
                  href="/"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-[8px] bg-[var(--surface-low)] px-5 py-3.5 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-high)]"
                >
                  Explorar a prévia gratuita
                </a>

                <FeatureList items={freeBenefits} />
              </section>

              <section className="flex h-full flex-col rounded-[8px] bg-[var(--surface-lowest)] px-6 py-7 text-center shadow-[0_24px_48px_rgba(0,0,0,0.06)] sm:px-7 sm:py-8 lg:px-8 lg:py-10">
                <div className="flex flex-col items-center">
                  <h2 className="bg-gradient-to-r from-[#FF3B8A] via-[#9B51E0] to-[#2F80ED] bg-clip-text text-[2rem] leading-[0.95] font-black tracking-[-0.06em] text-transparent">
                    Premium
                  </h2>
                  <p className="mt-4 max-w-[28rem] text-sm leading-6 text-[var(--secondary)] md:min-h-[6.5rem]">
                    Destrave prompts premium para SaaS, AI, Agency, Hero, Pricing
                    e CTA, e ganhe mais repertório para construir sem sair do zero.
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

          <section className="mx-auto mt-8 grid w-full max-w-[980px] gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-[8px] bg-[var(--surface-low)] px-6 py-6 sm:px-7">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--secondary)]">
                Para quem isso encaixa melhor
              </p>
              <div className="mt-4 grid gap-3">
                {proofPoints.map((point) => (
                  <p
                    key={point}
                    className="rounded-[8px] bg-[var(--surface-lowest)] px-4 py-3 text-sm leading-6 text-[var(--secondary)]"
                  >
                    {point}
                  </p>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--secondary)]">
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--surface-lowest)] px-3 py-2">
                  Stripe
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--surface-lowest)] px-3 py-2">
                  Pix e cartão
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--surface-lowest)] px-3 py-2">
                  Pagamento único
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--surface-lowest)] px-3 py-2">
                  Acesso vitalício
                </span>
              </div>
            </div>

            <div className="rounded-[8px] bg-[var(--surface-low)] px-6 py-6 sm:px-7">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--secondary)]">
                FAQ de compra
              </p>
              <div className="mt-4 space-y-3">
                {faqItems.map((item) => (
                  <div
                    key={item.question}
                    className="rounded-[8px] bg-[var(--surface-lowest)] px-4 py-4"
                  >
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                      {item.question}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--secondary)]">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}

