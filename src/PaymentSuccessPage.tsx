import { useEffect, useMemo, useState } from 'react'
import {
  hasActivePremiumAccess,
  hasPendingPremiumActivation,
  hasRevokedPremiumAccess,
} from './auth/access'
import { usePremiumAccess } from './auth/usePremiumAccess'
import logoImage from './assets/logo.png'
import { trackMetaEvent } from './lib/metaPixel'

const MAX_AUTO_REFRESH_ATTEMPTS = 5
const META_PURCHASE_TRACKED_KEY = 'prompt-archive-meta-purchase-tracked'
const PREMIUM_PRICE_BRL = 59.9

function getSourceSlug(search: string) {
  const sourceSlug = new URLSearchParams(search).get('source_slug')?.trim()
  return sourceSlug || null
}

function getCheckoutSessionId(search: string) {
  const checkoutSessionId = new URLSearchParams(search).get('session_id')?.trim()
  return checkoutSessionId || null
}

export function PaymentSuccessPage() {
  const { accessState, errorMessage, isLoading, refresh, userEmail } = usePremiumAccess()
  const [refreshAttempts, setRefreshAttempts] = useState(0)
  const [isRefreshingNow, setIsRefreshingNow] = useState(false)
  const sourceSlug = useMemo(
    () => (typeof window === 'undefined' ? null : getSourceSlug(window.location.search)),
    [],
  )
  const checkoutSessionId = useMemo(
    () => (typeof window === 'undefined' ? null : getCheckoutSessionId(window.location.search)),
    [],
  )
  const hasPremiumAccess = hasActivePremiumAccess(accessState)
  const isPendingWebhook = hasPendingPremiumActivation(accessState)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !isPendingWebhook ||
      refreshAttempts >= MAX_AUTO_REFRESH_ATTEMPTS
    ) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setRefreshAttempts((current) => current + 1)
      void refresh()
    }, 1800)

    return () => window.clearTimeout(timer)
  }, [isPendingWebhook, refresh, refreshAttempts])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !checkoutSessionId
    ) {
      return
    }

    const trackedPurchaseKey = `${META_PURCHASE_TRACKED_KEY}:${checkoutSessionId}`

    if (window.sessionStorage.getItem(trackedPurchaseKey) === '1') {
      return
    }

    trackMetaEvent('Purchase', {
      currency: 'BRL',
      value: PREMIUM_PRICE_BRL,
      transaction_id: checkoutSessionId,
    })
    window.sessionStorage.setItem(trackedPurchaseKey, '1')
  }, [checkoutSessionId])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      checkoutSessionId ||
      !hasPremiumAccess ||
      window.sessionStorage.getItem(META_PURCHASE_TRACKED_KEY) === '1'
    ) {
      return
    }

    trackMetaEvent('Purchase', {
      currency: 'BRL',
      value: PREMIUM_PRICE_BRL,
    })
    window.sessionStorage.setItem(META_PURCHASE_TRACKED_KEY, '1')
  }, [checkoutSessionId, hasPremiumAccess])

  async function handleRefresh() {
    setIsRefreshingNow(true)

    try {
      await refresh()
    } finally {
      setIsRefreshingNow(false)
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.06),transparent_28%),radial-gradient(circle_at_92%_14%,rgba(0,0,0,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(243,243,244,0.85)_44%,rgba(255,255,255,0.8)_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[980px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-4">
            <a href="/" className="flex items-center">
              <img
                src={logoImage}
                alt="Prompt Archive"
                draggable={false}
                className="h-7 w-auto object-contain sm:h-12"
              />
            </a>
            <a
              href="/pricing/"
              className="inline-flex items-center justify-center rounded-[8px] bg-[var(--surface-lowest)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface)]"
            >
              Voltar ao pricing
            </a>
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-[760px] flex-1 items-center justify-center py-10">
          <div className="w-full rounded-[8px] bg-[var(--surface-low)] p-3 sm:p-4 lg:p-5">
            <div className="rounded-[8px] bg-[var(--surface-lowest)] px-6 py-8 text-center sm:px-8 sm:py-10">
              <p className="text-[0.72rem] font-semibold tracking-[0.26em] text-[var(--secondary)] uppercase">
                stripe success
              </p>

              <h1 className="mt-5 text-[clamp(2rem,6vw,4rem)] leading-[0.92] font-black tracking-[-0.06em]">
                {hasPremiumAccess
                  ? 'PREMIUM LIBERADO'
                  : isPendingWebhook || isLoading
                    ? 'CONFIRMANDO SEU PAGAMENTO'
                    : hasRevokedPremiumAccess(accessState)
                      ? 'ACESSO REVOGADO'
                      : accessState.isAuthenticated
                        ? 'SESSAO AUTENTICADA'
                        : 'ENTRE NA MESMA CONTA'}
              </h1>

              <p className="mx-auto mt-5 max-w-[33rem] text-sm leading-6 text-[var(--secondary)] sm:text-base">
                {hasPremiumAccess
                  ? 'O webhook ja marcou seu usuario como premium. Agora os cards bloqueados no catalogo voltam a exibir o botao de copia.'
                  : isPendingWebhook || isLoading
                    ? 'Aguardando o webhook consolidar o pagamento e atualizar a linha de acesso desta conta.'
                  : hasRevokedPremiumAccess(accessState)
                      ? 'Seu usuario esta autenticado, mas o premium foi revogado. Gere um novo checkout se precisar reativar.'
                    : accessState.isAuthenticated
                        ? 'Voce esta logado, mas ainda nao existe uma liberacao premium ativa para esta conta.'
                        : 'Entre na mesma conta usada antes de iniciar o checkout para consultar a liberacao do premium.'}
              </p>

              {userEmail ? (
                <p className="mt-4 text-sm font-medium text-[var(--foreground)]">
                  Conta atual: {userEmail}
                </p>
              ) : null}

              {sourceSlug ? (
                <p className="mt-3 text-sm text-[var(--secondary)]">
                  Origem registrada no checkout: {sourceSlug}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="mt-5 rounded-[8px] bg-[#fff0f0] px-4 py-3 text-sm text-[#8f1d1d]">
                  {errorMessage}
                </p>
              ) : null}

              {isPendingWebhook ? (
                <p className="mt-5 rounded-[8px] bg-[var(--surface-low)] px-4 py-3 text-sm text-[var(--foreground)]">
                  Tentativas automaticas de confirmacao: {Math.min(refreshAttempts, MAX_AUTO_REFRESH_ATTEMPTS)} de {MAX_AUTO_REFRESH_ATTEMPTS}
                </p>
              ) : null}

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                {hasPremiumAccess ? (
                  <>
                    <a
                      href="/"
                      className="inline-flex items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92"
                    >
                      Abrir catalogo premium
                    </a>
                    <a
                      href="/pricing/"
                      className="inline-flex items-center justify-center rounded-[8px] bg-[var(--surface-low)] px-5 py-3.5 font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-high)]"
                    >
                      Ver status da conta
                    </a>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRefresh()
                      }}
                      disabled={isRefreshingNow}
                      className="inline-flex items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92 disabled:cursor-wait disabled:opacity-70"
                    >
                      {isRefreshingNow ? 'Atualizando...' : 'Verificar novamente'}
                    </button>
                    <a
                      href="/pricing/"
                      className="inline-flex items-center justify-center rounded-[8px] bg-[var(--surface-low)] px-5 py-3.5 font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-high)]"
                    >
                      Voltar ao pricing
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
