import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ComponentCard } from './components/ComponentCard'
import {
  getCatalogContent,
  getStaticCatalog,
  refreshCatalogMetadata,
} from './catalog/repository'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import { filterCatalog } from './lib/filterCatalog'
import type { CatalogCardItem } from './types'

const ERROR_PREFIX = 'error:'
const PENDING_PREFIX = 'pending:'
const INITIAL_RENDER_COUNT = 24
const RENDER_BATCH_SIZE = 12

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
    return 'Copying markdown'
  }

  return copiedId.startsWith(ERROR_PREFIX) ? 'Copy failed' : 'Markdown copied'
}

function App() {
  const initialCatalogRef = useRef<CatalogCardItem[] | null>(null)

  if (initialCatalogRef.current === null) {
    initialCatalogRef.current = getStaticCatalog()
  }

  const [catalogItems, setCatalogItems] = useState<CatalogCardItem[]>(
    initialCatalogRef.current,
  )
  const [catalogRefreshState, setCatalogRefreshState] = useState<
    'idle' | 'refreshing' | 'error'
  >('idle')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(() =>
    initialCatalogRef.current?.length
      ? Math.min(INITIAL_RENDER_COUNT, initialCatalogRef.current.length)
      : 0,
  )
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let isCancelled = false
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    setCatalogRefreshState('refreshing')

    async function syncCatalogMetadata() {
      try {
        const items = await refreshCatalogMetadata()

        if (isCancelled) {
          return
        }

        startTransition(() => {
          setCatalogItems(items)
        })
        setCatalogRefreshState('idle')
        setCatalogError(null)
      } catch (error) {
        if (isCancelled) {
          return
        }

        setCatalogRefreshState('error')
        setCatalogError(
          error instanceof Error ? error.message : 'Could not refresh catalog.',
        )
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

  const filteredItems = filterCatalog(catalogItems, deferredQuery)
  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasCatalogItems = catalogItems.length > 0

  useEffect(() => {
    setVisibleCount(
      filteredItems.length ? Math.min(INITIAL_RENDER_COUNT, filteredItems.length) : 0,
    )
  }, [deferredQuery])

  useEffect(() => {
    setVisibleCount((current) => {
      if (!filteredItems.length) {
        return 0
      }

      if (!current) {
        return Math.min(INITIAL_RENDER_COUNT, filteredItems.length)
      }

      return Math.min(current, filteredItems.length)
    })
  }, [filteredItems.length])

  useEffect(() => {
    if (visibleCount >= filteredItems.length) {
      return undefined
    }

    const sentinel = loadMoreSentinelRef.current

    if (!sentinel) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      setVisibleCount(filteredItems.length)
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
  }, [filteredItems.length, visibleCount])

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.06),transparent_28%),radial-gradient(circle_at_92%_16%,rgba(0,0,0,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(243,243,244,0.85)_44%,rgba(255,255,255,0.8)_100%)]" />
      <div className="pointer-events-none absolute left-[-14rem] top-[8rem] h-[22rem] w-[22rem] rounded-full bg-black/4 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[32rem] h-[18rem] w-[18rem] rounded-full bg-black/5 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="pb-8 pt-8 sm:pt-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h1 className="max-w-[11ch] text-[clamp(4.5rem,10vw,8rem)] leading-[0.9] font-black tracking-[-0.07em] text-[var(--foreground)] uppercase">
            Prompt Archive
          </h1>

          <label className="block w-full lg:max-w-[20rem] xl:max-w-[24rem] pb-2">
            <span className="sr-only">Search prompts or types</span>
            <div className="flex items-center gap-3 border-b border-[var(--outline)] pb-3 text-[var(--secondary)] transition focus-within:border-b-2 focus-within:border-[var(--primary)] focus-within:pb-[11px] focus-within:text-[var(--foreground)]">
              <svg
                viewBox="0 0 24 24"
                className="size-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search prompts or types"
                aria-label="Search prompts or types"
                className="w-full border-none bg-transparent p-0 text-[0.95rem] text-[var(--foreground)] outline-none placeholder:text-[var(--secondary)]"
              />
            </div>
          </label>
        </header>

        <section
          id="component-grid-panel"
          className="mt-6 rounded-[8px] bg-[var(--surface-low)] px-5 py-6 sm:px-6 sm:py-8"
        >
          <div className="flex justify-end">
            <p
              aria-live="polite"
              className="min-h-5 text-sm text-[var(--secondary)]"
            >
              {getLiveMessage(copiedId)}
            </p>
          </div>

          {!hasCatalogItems && catalogRefreshState === 'refreshing' ? (
            <div className="mt-8 rounded-[1.5rem] border border-[var(--ghost-border)] bg-[var(--surface-lowest)] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Loading public catalog
              </p>
              <p className="mt-2 text-sm text-[var(--secondary)]">
                Reading the card list from Supabase.
              </p>
            </div>
          ) : !hasCatalogItems && catalogRefreshState === 'error' ? (
            <div className="mt-8 rounded-[1.5rem] border border-[#f2b7b7] bg-[#fff0f0] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[#8f1d1d]">
                Public catalog unavailable
              </p>
              <p className="mt-2 text-sm text-[#8f1d1d]/80">
                {catalogError ?? 'Check the Supabase environment variables and table.'}
              </p>
            </div>
          ) : filteredItems.length ? (
            <>
              <div className="mx-auto mt-8 max-w-[1136px] columns-1 gap-3 sm:columns-2 lg:columns-4">
                {visibleItems.map((item) => (
                  <div key={item.slug} className="mb-3 break-inside-avoid">
                    <ComponentCard
                      item={item}
                      copyState={getCopyState(copiedId, item.slug)}
                      onCopy={handleCopy}
                    />
                  </div>
                ))}
              </div>

              {visibleItems.length < filteredItems.length ? (
                <div
                  ref={loadMoreSentinelRef}
                  className="mt-6 rounded-[1rem] border border-[var(--ghost-border)] bg-[var(--surface-lowest)] px-4 py-5 text-center text-sm text-[var(--secondary)]"
                >
                  Loading more cards
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-8 rounded-[1.5rem] border border-[var(--ghost-border)] bg-[var(--surface-lowest)] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                No prompts found
              </p>
              <p className="mt-2 text-sm text-[var(--secondary)]">
                Try a different search term or wait until more Markdown files
                are synced.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
