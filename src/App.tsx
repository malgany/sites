import {
  startTransition,
  useEffect,
  useRef,
  useState,
} from 'react'
import { hasActivePremiumAccess } from './auth/access'
import { usePremiumAccess } from './auth/usePremiumAccess'
import logoImage from './assets/logo.png'
import { loadCachedCatalog, storeCachedCatalog } from './catalog/cache'
import { getCatalogContent, refreshCatalogMetadata } from './catalog/repository'
import { ComponentCard } from './components/ComponentCard'
import { getCatalogPricingHref } from './lib/catalogAccess'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import {
  distributeCatalogItemsAcrossColumns,
  getCatalogGridColumnCount,
} from './lib/distributeCatalogColumns'
import type { CatalogCardItem } from './types'

const ERROR_PREFIX = 'error:'
const PENDING_PREFIX = 'pending:'
const INITIAL_RENDER_COUNT = 24
const RENDER_BATCH_SIZE = 12
const CATALOG_LOADING_MESSAGE = 'Carregando a lista de cards.'
const CATALOG_REFRESHING_MESSAGE = 'Atualizando catalogo.'
const CATALOG_REFRESH_ERROR_MESSAGE =
  'Nao foi possivel atualizar o catalogo. Exibindo a ultima versao salva.'
const CATALOG_BLOCKING_ERROR_MESSAGE =
  'O catalogo esta temporariamente indisponivel. Tente novamente em instantes.'

function getCopyState(copiedId: string | null, itemSlug: string) {
  if (copiedId === itemSlug) {
    return 'copied'
  }

  if (copiedId === `${PENDING_PREFIX}${itemSlug}`) {
    return 'pending'
  }

  if (copiedId === `${ERROR_PREFIX}${itemSlug}`) {
    return 'error'
  }

  return 'idle'
}

function getLiveMessage(copiedId: string | null) {
  if (!copiedId) {
    return ''
  }

  if (copiedId.startsWith(PENDING_PREFIX)) {
    return 'Copiando markdown'
  }

  return copiedId.startsWith(ERROR_PREFIX)
    ? 'Falha ao copiar'
    : 'Markdown copiado'
}

function getCatalogStatusMessage(
  catalogRefreshState: 'idle' | 'refreshing' | 'error',
  hasCatalogItems: boolean,
  hasCachedCatalog: boolean,
) {
  if (!hasCatalogItems) {
    return ''
  }

  if (catalogRefreshState === 'refreshing') {
    return CATALOG_REFRESHING_MESSAGE
  }

  if (catalogRefreshState === 'error') {
    return hasCachedCatalog
      ? CATALOG_REFRESH_ERROR_MESSAGE
      : 'Nao foi possivel atualizar o catalogo.'
  }

  return ''
}

function App() {
  const pricingHref = getCatalogPricingHref()
  const { accessState } = usePremiumAccess()
  const [initialCachedCatalog] = useState<CatalogCardItem[]>(() => loadCachedCatalog())

  const [catalogItems, setCatalogItems] = useState<CatalogCardItem[]>(
    initialCachedCatalog,
  )
  const [catalogRefreshState, setCatalogRefreshState] = useState<
    'idle' | 'refreshing' | 'error'
  >('refreshing')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [gridColumnCount, setGridColumnCount] = useState(() =>
    getCatalogGridColumnCount(
      typeof window === 'undefined' ? Number.NaN : window.innerWidth,
    ),
  )
  const [visibleCount, setVisibleCount] = useState(() =>
    initialCachedCatalog.length
      ? Math.min(INITIAL_RENDER_COUNT, initialCachedCatalog.length)
      : 0,
  )
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const hasCachedCatalog = Boolean(initialCachedCatalog.length)

  useEffect(() => {
    let isCancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    async function syncCatalogMetadata() {
      try {
        const items = await refreshCatalogMetadata()

        if (isCancelled) {
          return
        }

        storeCachedCatalog(items)

        startTransition(() => {
          setCatalogItems(items)
          setVisibleCount((current) => {
            if (!items.length) {
              return 0
            }

            if (!current) {
              return Math.min(INITIAL_RENDER_COUNT, items.length)
            }

            return Math.min(current, items.length)
          })
        })
        setCatalogRefreshState('idle')
        setCatalogError(null)
      } catch (error) {
        if (isCancelled) {
          return
        }

        console.error('Catalog refresh failed.', error)
        setCatalogRefreshState('error')
        setCatalogError(CATALOG_BLOCKING_ERROR_MESSAGE)
      }
    }

    const runSyncWhenIdle = () => {
      if (isCancelled) {
        return
      }

      void syncCatalogMetadata()
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(runSyncWhenIdle, { timeout: 1200 })
    } else {
      timeoutHandle = window.setTimeout(runSyncWhenIdle, 250)
    }

    return () => {
      isCancelled = true
      if (idleHandle !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [])

  useEffect(() => {
    if (!copiedId || copiedId.startsWith(PENDING_PREFIX)) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setCopiedId(null)
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [copiedId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncGridColumnCount = () => {
      setGridColumnCount(getCatalogGridColumnCount(window.innerWidth))
    }

    syncGridColumnCount()
    window.addEventListener('resize', syncGridColumnCount)

    return () => {
      window.removeEventListener('resize', syncGridColumnCount)
    }
  }, [])

  async function handleCopy(item: CatalogCardItem) {
    setCopiedId(`${PENDING_PREFIX}${item.slug}`)

    try {
      const content = await getCatalogContent(item.slug)
      const didCopy = await copyTextToClipboard(content)
      setCopiedId(didCopy ? item.slug : `${ERROR_PREFIX}${item.slug}`)
    } catch {
      setCopiedId(`${ERROR_PREFIX}${item.slug}`)
    }
  }

  const filteredItems = catalogItems
  const supportsIntersectionObserver = typeof IntersectionObserver !== 'undefined'
  const effectiveVisibleCount = supportsIntersectionObserver
    ? visibleCount
    : filteredItems.length
  const visibleItems = filteredItems.slice(0, effectiveVisibleCount)
  const columnizedVisibleItems = distributeCatalogItemsAcrossColumns(
    visibleItems,
    gridColumnCount,
  )
  const hasCatalogItems = catalogItems.length > 0
  const hasPremiumAccess = hasActivePremiumAccess(accessState)
  const upgradeCtaLabel = hasPremiumAccess ? 'Premium Ativo' : 'Acesso Ilimitado'
  const catalogStatusMessage = getCatalogStatusMessage(
    catalogRefreshState,
    hasCatalogItems,
    hasCachedCatalog,
  )

  useEffect(() => {
    if (visibleCount >= filteredItems.length) {
      return undefined
    }

    const sentinel = loadMoreSentinelRef.current

    if (!sentinel) {
      return undefined
    }

    if (!supportsIntersectionObserver) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return
        }

        startTransition(() => {
          setVisibleCount((current) =>
            Math.min(current + RENDER_BATCH_SIZE, filteredItems.length),
          )
        })
      },
      {
        rootMargin: '480px 0px',
      },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [filteredItems.length, supportsIntersectionObserver, visibleCount])

  return (
    <main
      id="top"
      className="relative min-h-screen overflow-hidden bg-[var(--surface)] text-[var(--foreground)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.06),transparent_28%),radial-gradient(circle_at_92%_16%,rgba(0,0,0,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(243,243,244,0.85)_44%,rgba(255,255,255,0.8)_100%)]" />
      <div className="pointer-events-none absolute left-[-14rem] top-[8rem] h-[22rem] w-[22rem] rounded-full bg-black/4 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[22rem] h-[18rem] w-[18rem] rounded-full bg-black/7 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-[8px] px-5 py-5 text-[var(--foreground)] sm:px-6 sm:py-6">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 lg:gap-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex shrink-0 items-center">
                <img
                  src={logoImage}
                  alt="Prompt Archive"
                  draggable={false}
                  className="h-7 w-auto object-contain sm:h-12"
                />
              </div>

              <nav
                aria-label="Principal"
                className="flex shrink-0 items-center gap-2 text-sm sm:gap-3"
              >
                <a
                  href={pricingHref}
                  className="inline-flex items-center rounded-[8px] px-2.5 py-2 font-medium text-[var(--secondary)] transition hover:text-[var(--foreground)] sm:px-3"
                >
                  Preços
                </a>
                <a
                  href={pricingHref}
                  className="inline-flex items-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-4 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92 sm:px-5"
                >
                  {upgradeCtaLabel}
                </a>
              </nav>
            </div>

            <div className="mx-auto flex w-full max-w-[49rem] flex-col items-center text-center">
              <h1 className="mt-4 max-w-[13ch] text-[clamp(2.45rem,8vw,4.8rem)] leading-[0.9] font-black tracking-[-0.07em] text-[var(--foreground)] uppercase">
                Destrave seus
                <span className="block bg-gradient-to-r from-[#FF3B8A] via-[#9B51E0] to-[#2F80ED] bg-clip-text text-transparent">
                  superpoderes
                </span>
                de design com IA
              </h1>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <a
                  href="#component-grid-panel"
                  className="inline-flex items-center justify-center rounded-[8px] bg-[var(--surface-high)] px-6 py-3.5 text-base font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-highest)]"
                >
                  Explorar prompts
                </a>
                <a
                  href={pricingHref}
                  className="inline-flex items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-6 py-3.5 text-base font-medium text-[var(--on-primary)] transition hover:opacity-92"
                >
                  {upgradeCtaLabel}
                </a>
              </div>
            </div>
          </div>
        </header>

        <section
          id="component-grid-panel"
          className="relative z-10 -mt-4 rounded-[8px] bg-[var(--surface-low)] px-5 py-6 sm:-mt-6 sm:px-6 sm:py-8 lg:-mt-20"
        >
          <div className="mx-auto mt-2 flex max-w-[1136px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-h-5 text-sm text-[var(--secondary)]">
              {catalogStatusMessage}
            </p>
            <p
              aria-live="polite"
              className="min-h-5 text-sm text-[var(--secondary)] sm:text-right"
            >
              {getLiveMessage(copiedId)}
            </p>
          </div>

          {!hasCatalogItems && catalogRefreshState === 'refreshing' ? (
            <div className="mx-auto mt-8 max-w-[1136px] rounded-[8px] bg-[var(--surface-lowest)] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Carregando catalogo
              </p>
              <p className="mt-2 text-sm text-[var(--secondary)]">
                {CATALOG_LOADING_MESSAGE}
              </p>
            </div>
          ) : !hasCatalogItems && catalogRefreshState === 'error' ? (
            <div className="mx-auto mt-8 max-w-[1136px] rounded-[8px] bg-[#fff0f0] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[#8f1d1d]">
                Catalogo indisponivel
              </p>
              <p className="mt-2 text-sm text-[#8f1d1d]/80">
                {catalogError ?? CATALOG_BLOCKING_ERROR_MESSAGE}
              </p>
            </div>
          ) : filteredItems.length ? (
            <>
              <div className="mx-auto mt-3 grid max-w-[1136px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {columnizedVisibleItems.map((columnItems, columnIndex) => (
                  <div
                    key={`catalog-column:${gridColumnCount}:${columnIndex}`}
                    className="flex flex-col gap-3"
                  >
                    {columnItems.map((item) => (
                      <ComponentCard
                        hasPremiumAccess={hasPremiumAccess}
                        key={[
                          item.slug,
                          item.posterUrl ?? '',
                          item.animatedPreviewUrl ?? '',
                          item.previewWidth ?? '',
                          item.previewHeight ?? '',
                        ].join(':')}
                        item={item}
                        copyState={getCopyState(copiedId, item.slug)}
                        onCopy={handleCopy}
                        pricingHref={getCatalogPricingHref(item.slug)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {effectiveVisibleCount < filteredItems.length ? (
                <div
                  ref={loadMoreSentinelRef}
                  className="mx-auto mt-6 max-w-[1136px] rounded-[8px] bg-[var(--surface-lowest)] px-4 py-5 text-center text-sm text-[var(--secondary)]"
                >
                  Carregando mais cards
                </div>
              ) : null}
            </>
          ) : (
            <div className="mx-auto mt-8 max-w-[1136px] rounded-[8px] bg-[var(--surface-lowest)] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Nenhum prompt encontrado
              </p>
              <p className="mt-2 text-sm text-[var(--secondary)]">
                Tente outro termo de busca ou aguarde a proxima sincronizacao do catalogo.
              </p>
            </div>
          )}
        </section>

        <footer className="mt-8 rounded-[8px] bg-[var(--surface-low)] px-5 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto flex max-w-[1136px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[var(--secondary)]">
              React, Tailwind, preview em movimento e copia rapida no mesmo lugar.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={pricingHref}
                className="inline-flex items-center rounded-[8px] bg-[var(--surface-lowest)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-high)]"
              >
                {hasPremiumAccess ? 'Premium Ativo' : 'Preços'}
              </a>
              <a
                href="#top"
                className="inline-flex items-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-4 py-2 text-sm font-medium text-[var(--on-primary)] transition hover:opacity-92"
              >
                Voltar ao topo
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

export default App
