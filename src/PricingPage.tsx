import { useMemo, useState, type FormEvent } from 'react'
import {
  canStartPremiumCheckout,
  hasActivePremiumAccess,
  hasPendingPremiumActivation,
  hasRevokedPremiumAccess,
} from './auth/access'
import { createPremiumCheckoutSession, requestMagicLink } from './auth/api'
import { getCurrentPricingPath } from './auth/redirects'
import { usePremiumAccess } from './auth/usePremiumAccess'
import logoImage from './assets/logo.png'
import { assignBrowserLocation } from './lib/browserNavigation'

type FeatureItem = {
  label: string
  emphasis?: boolean
}

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
  { label: 'Liberacao automatica por webhook apos o pagamento' },
]

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

function getSourceSlug(search: string) {
  const sourceSlug = new URLSearchParams(search).get('from')?.trim()
  return sourceSlug || null
}

function getStatusCopy(
  isLoading: boolean,
  accessState: ReturnType<typeof usePremiumAccess>['accessState'],
) {
  if (isLoading) {
    return {
      title: 'Verificando sua sessao',
      body: 'Conferindo se voce ja tem login valido e qual o estado atual do premium.',
      buttonLabel: null,
    }
  }

  if (!accessState.isAuthenticated) {
    return {
      title: 'Entre com seu e-mail antes de pagar',
      body: 'O login conecta a compra a uma conta real e evita liberar o premium no e-mail errado.',
      buttonLabel: 'Receber magic link',
    }
  }

  if (hasActivePremiumAccess(accessState)) {
    return {
      title: 'Premium ativo nesta conta',
      body: 'Seu acesso ja esta liberado. Voce pode voltar ao catalogo e copiar os cards premium.',
      buttonLabel: null,
    }
  }

  if (hasPendingPremiumActivation(accessState)) {
    return {
      title: 'Pagamento em andamento',
      body: 'Abra um novo checkout ou aguarde a confirmacao do webhook para o premium ficar ativo.',
      buttonLabel: 'Finalizar pagamento',
    }
  }

  if (hasRevokedPremiumAccess(accessState)) {
    return {
      title: 'Acesso revogado',
      body: 'Este login ja teve premium revogado. Voce pode gerar um novo checkout para regularizar.',
      buttonLabel: 'Regularizar acesso',
    }
  }

  return {
    title: 'Conta pronta para checkout',
    body: 'Seu login ja esta confirmado. O proximo passo e abrir o Stripe Checkout desta conta.',
    buttonLabel: 'Comprar acesso vitalicio',
  }
}

export function PricingPage() {
  const { accessState, errorMessage, isLoading, signOut, userEmail } = usePremiumAccess()
  const [email, setEmail] = useState('')
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null)
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const sourceSlug = useMemo(
    () => (typeof window === 'undefined' ? null : getSourceSlug(window.location.search)),
    [],
  )

  const statusCopy = getStatusCopy(isLoading, accessState)
  const showCheckoutAction = canStartPremiumCheckout(accessState) && !isLoading
  const hasPremiumAccess = hasActivePremiumAccess(accessState)
  const sourceNote = sourceSlug
    ? `Origem do upgrade: ${sourceSlug}. Esse parametro sera enviado junto com a Checkout Session.`
    : 'Se voce veio de um card premium, o slug de origem entra automaticamente na Checkout Session.'

  async function handleRequestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setMagicLinkError('Digite um e-mail valido para receber o magic link.')
      return
    }

    setIsSendingMagicLink(true)
    setMagicLinkError(null)
    setCheckoutError(null)

    try {
      await requestMagicLink(normalizedEmail, getCurrentPricingPath())
      setMagicLinkSentTo(normalizedEmail)
    } catch (error) {
      setMagicLinkError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel enviar o magic link agora.',
      )
    } finally {
      setIsSendingMagicLink(false)
    }
  }

  async function handleCheckout() {
    setIsStartingCheckout(true)
    setCheckoutError(null)

    try {
      const checkoutUrl = await createPremiumCheckoutSession(sourceSlug)
      assignBrowserLocation(checkoutUrl)
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel abrir o checkout agora.',
      )
      setIsStartingCheckout(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)

    try {
      await signOut()
      setMagicLinkSentTo(null)
      setMagicLinkError(null)
      setCheckoutError(null)
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel encerrar a sessao agora.',
      )
    } finally {
      setIsSigningOut(false)
    }
  }

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
          <div className="mx-auto max-w-[56rem] text-center">
            <p className="text-[0.72rem] font-semibold tracking-[0.26em] text-[var(--secondary)] uppercase">
              login + checkout + webhook
            </p>
            <h1 className="mx-auto mt-6 max-w-[16ch] text-[clamp(2rem,8vw,5.4rem)] leading-[0.9] font-black tracking-[-0.07em]">
              PAGUE 1 VEZ
              <span className="mt-2 block bg-gradient-to-r from-[#FF3B8A] via-[#9B51E0] to-[#2F80ED] bg-clip-text text-transparent">
                ENTRE COM O MESMO E-MAIL
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-[44rem] text-sm leading-6 text-[var(--secondary)] sm:text-base">
              O premium do v1 usa magic link antes do checkout. A compra fica ligada a
              conta autenticada e o acesso so abre quando o webhook confirmar o
              pagamento.
            </p>
          </div>

          <div className="mx-auto mt-10 flex w-full max-w-[980px] flex-wrap items-center justify-center gap-3 rounded-[8px] bg-[var(--surface-low)] px-5 py-4 text-center text-[0.82rem] font-medium text-[var(--secondary)]">
            <span className="rounded-full bg-[var(--surface-lowest)] px-4 py-2 text-[var(--foreground)]">
              1. Entrar por e-mail
            </span>
            <span className="rounded-full bg-[var(--surface-lowest)] px-4 py-2 text-[var(--foreground)]">
              2. Abrir Stripe Checkout
            </span>
            <span className="rounded-full bg-[var(--surface-lowest)] px-4 py-2 text-[var(--foreground)]">
              3. Liberar premium via webhook
            </span>
          </div>

          <div className="mx-auto mt-4 w-full max-w-[980px] rounded-[8px] bg-[var(--surface-low)] px-5 py-4 text-center text-sm text-[var(--secondary)]">
            {sourceNote}
          </div>

          <div className="mx-auto mt-8 w-full max-w-[980px] rounded-[8px] bg-[var(--surface-low)] p-3 sm:p-4 lg:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
              <section className="flex h-full flex-col rounded-[8px] bg-[var(--surface-lowest)] px-6 py-7 text-center sm:px-7 sm:py-8 lg:px-8 lg:py-10">
                <div className="flex flex-col items-center">
                  <h2 className="text-[2rem] leading-[0.95] font-black tracking-[-0.06em]">
                    Free
                  </h2>
                  <p className="mt-4 max-w-[24rem] text-sm leading-6 text-[var(--secondary)] md:min-h-[6.5rem]">
                    Entrada livre para explorar a vitrine, assistir aos previews e copiar
                    tudo o que continuar aberto para visitantes.
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
                    exclusivos, com acesso conectado a uma conta real.
                  </p>
                  <p className="mt-6 text-[3.15rem] leading-none font-black tracking-[-0.08em]">
                    R$ 59,90
                  </p>
                </div>

                <div className="mt-8 rounded-[8px] bg-[var(--surface-low)] px-5 py-5 text-left">
                  <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-[var(--secondary)] uppercase">
                    Estado atual
                  </p>
                  <h3 className="mt-3 text-[1.3rem] leading-[1] font-black tracking-[-0.05em] text-[var(--foreground)]">
                    {statusCopy.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--secondary)]">
                    {statusCopy.body}
                  </p>

                  {userEmail ? (
                    <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
                      Sessao atual: {userEmail}
                    </p>
                  ) : null}

                  {magicLinkSentTo ? (
                    <p className="mt-4 rounded-[8px] bg-[var(--surface-lowest)] px-4 py-3 text-sm text-[var(--foreground)]">
                      Link enviado para {magicLinkSentTo}. Abra o e-mail e volte por ele.
                    </p>
                  ) : null}

                  {errorMessage ? (
                    <p className="mt-4 rounded-[8px] bg-[#fff0f0] px-4 py-3 text-sm text-[#8f1d1d]">
                      {errorMessage}
                    </p>
                  ) : null}

                  {magicLinkError ? (
                    <p className="mt-4 rounded-[8px] bg-[#fff0f0] px-4 py-3 text-sm text-[#8f1d1d]">
                      {magicLinkError}
                    </p>
                  ) : null}

                  {checkoutError ? (
                    <p className="mt-4 rounded-[8px] bg-[#fff0f0] px-4 py-3 text-sm text-[#8f1d1d]">
                      {checkoutError}
                    </p>
                  ) : null}

                  {!accessState.isAuthenticated && !isLoading ? (
                    <form className="mt-5 space-y-4" onSubmit={handleRequestMagicLink}>
                      <label className="block">
                        <span className="text-[0.74rem] font-semibold tracking-[0.22em] text-[var(--secondary)] uppercase">
                          Seu e-mail
                        </span>
                        <input
                          type="email"
                          name="email"
                          value={email}
                          autoComplete="email"
                          placeholder="voce@dominio.com"
                          onChange={(event) => setEmail(event.currentTarget.value)}
                          className="mt-3 w-full border-0 border-b-2 border-[var(--ghost-border)] bg-transparent px-0 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[var(--foreground)]"
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={isSendingMagicLink}
                        className="inline-flex w-full items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92 disabled:cursor-wait disabled:opacity-70"
                      >
                        {isSendingMagicLink ? 'Enviando link...' : 'Receber magic link'}
                      </button>
                    </form>
                  ) : null}

                  {showCheckoutAction ? (
                    <div className="mt-5 space-y-3">
                      <button
                        type="button"
                        onClick={() => {
                          void handleCheckout()
                        }}
                        disabled={isStartingCheckout}
                        className="inline-flex w-full items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92 disabled:cursor-wait disabled:opacity-70"
                      >
                        {isStartingCheckout
                          ? 'Abrindo checkout...'
                          : statusCopy.buttonLabel ?? 'Abrir checkout'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void handleSignOut()
                        }}
                        disabled={isSigningOut}
                        className="inline-flex w-full items-center justify-center rounded-[8px] bg-[var(--surface-lowest)] px-5 py-3.5 font-medium text-[var(--foreground)] transition hover:bg-[var(--surface)] disabled:cursor-wait disabled:opacity-70"
                      >
                        {isSigningOut ? 'Saindo...' : 'Entrar com outro e-mail'}
                      </button>
                    </div>
                  ) : null}

                  {hasPremiumAccess ? (
                    <div className="mt-5 space-y-3">
                      <a
                        href="/payment-success/"
                        className="inline-flex w-full items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 text-center font-semibold text-[var(--on-primary)] transition hover:opacity-92"
                      >
                        Confirmar acesso
                      </a>
                      <a
                        href="/"
                        className="inline-flex w-full items-center justify-center rounded-[8px] bg-[var(--surface-lowest)] px-5 py-3.5 font-medium text-[var(--foreground)] transition hover:bg-[var(--surface)]"
                      >
                        Voltar ao catalogo premium
                      </a>
                    </div>
                  ) : null}
                </div>

                <FeatureList items={premiumBenefits} />
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
