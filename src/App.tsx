import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ComponentCard } from './components/ComponentCard'
import { loadCachedCatalog, storeCachedCatalog } from './catalog/cache'
import { getCatalogContent, refreshCatalogMetadata } from './catalog/repository'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import {
  distributeCatalogItemsAcrossColumns,
  getCatalogGridColumnCount,
} from './lib/distributeCatalogColumns'
import { filterCatalog } from './lib/filterCatalog'
import type { CatalogCardItem } from './types'
import logoImage from './assets/logo.png'

const ERROR_PREFIX = 'error:'
const PENDING_PREFIX = 'pending:'
const INITIAL_RENDER_COUNT = 24
const RENDER_BATCH_SIZE = 12
const TYPE_FILTER_SCROLL_STEP = 280
const CATALOG_LOADING_MESSAGE = 'Loading the card list.'
const CATALOG_REFRESHING_MESSAGE = 'Refreshing catalog.'
const CATALOG_REFRESH_ERROR_MESSAGE =
  'The catalog could not be refreshed. Showing the last saved version.'
const CATALOG_BLOCKING_ERROR_MESSAGE =
  'The catalog is temporarily unavailable. Please try again in a moment.'

function getCatalogTypeLabels(items: readonly CatalogCardItem[]) {
  return [...new Set(items.map((item) => item.typeLabel.trim()).filter(Boolean))]
}

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
      : 'The catalog could not be refreshed.'
  }

  return ''
}

function App() {
  const initialCachedCatalogRef = useRef<CatalogCardItem[] | null>(null)

  if (initialCachedCatalogRef.current === null) {
    initialCachedCatalogRef.current = loadCachedCatalog()
  }

  const [catalogItems, setCatalogItems] = useState<CatalogCardItem[]>(
    initialCachedCatalogRef.current,
  )
  const [catalogRefreshState, setCatalogRefreshState] = useState<
    'idle' | 'refreshing' | 'error'
  >('refreshing')
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [canScrollTypeFiltersLeft, setCanScrollTypeFiltersLeft] = useState(false)
  const [canScrollTypeFiltersRight, setCanScrollTypeFiltersRight] = useState(false)
  const [isDraggingTypeFilters, setIsDraggingTypeFilters] = useState(false)
  const [gridColumnCount, setGridColumnCount] = useState(() =>
    getCatalogGridColumnCount(
      typeof window === 'undefined' ? Number.NaN : window.innerWidth,
    ),
  )
  const [visibleCount, setVisibleCount] = useState(() =>
    initialCachedCatalogRef.current?.length
      ? Math.min(INITIAL_RENDER_COUNT, initialCachedCatalogRef.current.length)
      : 0,
  )
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null)
  const typeFiltersScrollRef = useRef<HTMLDivElement | null>(null)
  const typeFilterDragStateRef = useRef({
    active: false,
    moved: false,
    pointerId: null as number | null,
    startX: 0,
    startScrollLeft: 0,
  })
  const suppressTypeFilterClickRef = useRef(false)
  const deferredQuery = useDeferredValue(query)
  const catalogTypeLabels = getCatalogTypeLabels(catalogItems)
  const catalogTypeLabelsKey = catalogTypeLabels.join('|')
  const hasCachedCatalog = Boolean(initialCachedCatalogRef.current?.length)

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

        storeCachedCatalog(items)

        startTransition(() => {
          setCatalogItems(items)
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

  function handleTypeFiltersPointerEnd(pointerId: number) {
    const dragState = typeFilterDragStateRef.current

    if (!dragState.active || dragState.pointerId !== pointerId) {
      return
    }

    if (dragState.moved) {
      suppressTypeFilterClickRef.current = true
      window.setTimeout(() => {
        suppressTypeFilterClickRef.current = false
      }, 0)
    }

    typeFilterDragStateRef.current = {
      active: false,
      moved: false,
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
    }
    setIsDraggingTypeFilters(false)
  }

  useEffect(() => {
    function handleWindowPointerMove(event: PointerEvent) {
      const scroller = typeFiltersScrollRef.current
      const dragState = typeFilterDragStateRef.current

      if (
        !scroller ||
        !dragState.active ||
        dragState.pointerId !== event.pointerId
      ) {
        return
      }

      const delta = event.clientX - dragState.startX

      if (Math.abs(delta) > 6) {
        dragState.moved = true
      }

      if (dragState.moved) {
        event.preventDefault()
      }

      scroller.scrollLeft = dragState.startScrollLeft - delta
    }

    function handleWindowPointerEnd(event: PointerEvent) {
      handleTypeFiltersPointerEnd(event.pointerId)
    }

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: false,
    })
    window.addEventListener('pointerup', handleWindowPointerEnd)
    window.addEventListener('pointercancel', handleWindowPointerEnd)

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', handleWindowPointerEnd)
      window.removeEventListener('pointercancel', handleWindowPointerEnd)
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

  function handleTypeToggle(typeLabel: string) {
    setSelectedTypes((current) => {
      const isSelected = current.includes(typeLabel)

      if (isSelected) {
        return current.filter((currentType) => currentType !== typeLabel)
      }

      return catalogTypeLabels.filter((catalogTypeLabel) =>
        [...current, typeLabel].includes(catalogTypeLabel),
      )
    })
  }

  function handleResetFilters() {
    setQuery('')
    setSelectedTypes([])
  }

  function syncTypeFilterScrollState() {
    const scroller = typeFiltersScrollRef.current

    if (!scroller) {
      setCanScrollTypeFiltersLeft(false)
      setCanScrollTypeFiltersRight(false)
      return
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth
    const hasOverflow = maxScrollLeft > 1

    setCanScrollTypeFiltersLeft(hasOverflow && scroller.scrollLeft > 1)
    setCanScrollTypeFiltersRight(
      hasOverflow && scroller.scrollLeft < maxScrollLeft - 1,
    )
  }

  function handleTypeFiltersScroll(direction: 'left' | 'right') {
    const scroller = typeFiltersScrollRef.current

    if (!scroller) {
      return
    }

    scroller.scrollBy({
      left:
        direction === 'left'
          ? -TYPE_FILTER_SCROLL_STEP
          : TYPE_FILTER_SCROLL_STEP,
      behavior: 'smooth',
    })
  }

  function handleTypeFiltersPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    const scroller = typeFiltersScrollRef.current

    if (!scroller) {
      return
    }

    typeFilterDragStateRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: scroller.scrollLeft,
    }

    setIsDraggingTypeFilters(true)
  }

  function handleTypeFiltersClickCapture(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!suppressTypeFilterClickRef.current) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  const filteredItems = filterCatalog(catalogItems, deferredQuery, selectedTypes)
  const visibleItems = filteredItems.slice(0, visibleCount)
  const columnizedVisibleItems = distributeCatalogItemsAcrossColumns(
    visibleItems,
    gridColumnCount,
  )
  const hasCatalogItems = catalogItems.length > 0
  const catalogStatusMessage = getCatalogStatusMessage(
    catalogRefreshState,
    hasCatalogItems,
    hasCachedCatalog,
  )

  useEffect(() => {
    const availableTypes = new Set(catalogItems.map((item) => item.typeLabel.trim()))

    setSelectedTypes((current) => {
      if (!current.length) {
        return current
      }

      const nextSelectedTypes = current.filter((typeLabel) =>
        availableTypes.has(typeLabel),
      )

      return nextSelectedTypes.length === current.length
        ? current
        : nextSelectedTypes
    })
  }, [catalogItems])

  useEffect(() => {
    const scroller = typeFiltersScrollRef.current

    if (!scroller) {
      setCanScrollTypeFiltersLeft(false)
      setCanScrollTypeFiltersRight(false)
      return undefined
    }

    const handleScroll = () => {
      syncTypeFilterScrollState()
    }

    handleScroll()

    scroller.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [catalogTypeLabelsKey])

  useEffect(() => {
    setVisibleCount(
      filteredItems.length ? Math.min(INITIAL_RENDER_COUNT, filteredItems.length) : 0,
    )
  }, [deferredQuery, selectedTypes, filteredItems.length])

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
        <header className="px-5 pb-8 pt-8 sm:px-6 sm:pt-12">
          <div className="mx-auto grid max-w-[1136px] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start">
            <h1 className="flex items-center">
              <img
                src={logoImage}
                alt="Prompt Archive"
                draggable={false}
                className="h-auto w-full max-w-[300px] object-contain md:max-w-[420px] lg:max-w-[500px]"
              />
            </h1>

            <label className="block w-full pb-2 lg:justify-self-end lg:self-start">
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
          </div>
        </header>

        <section
          id="component-grid-panel"
          className="mt-6 rounded-[8px] bg-[var(--surface-low)] px-5 py-6 sm:px-6 sm:py-8"
        >
          {catalogTypeLabels.length ? (
            <div className="mx-auto max-w-[1136px] border-b border-black/8 pb-5">
              <div
                className="flex w-full items-center gap-3"
                aria-label="Prompt type filters"
              >
                <button
                  type="button"
                  aria-pressed={selectedTypes.length === 0}
                  onClick={handleResetFilters}
                  className={[
                    'inline-flex shrink-0 items-center rounded-full border px-3.5 py-2 text-[0.72rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase transition',
                    selectedTypes.length === 0
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                      : 'border-black/10 bg-[var(--surface-lowest)] text-[var(--secondary)] hover:border-black/20 hover:text-[var(--foreground)]',
                  ].join(' ')}
                >
                  <span>All</span>
                </button>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    aria-label="Scroll type filters left"
                    onClick={() => handleTypeFiltersScroll('left')}
                    disabled={!canScrollTypeFiltersLeft}
                    className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[var(--surface-lowest)] text-[var(--foreground)] transition hover:border-black/20 hover:bg-[var(--surface-high)] disabled:cursor-default disabled:opacity-35 sm:inline-flex"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>

                  <div
                    ref={typeFiltersScrollRef}
                    onPointerDown={handleTypeFiltersPointerDown}
                    onClickCapture={handleTypeFiltersClickCapture}
                    className={[
                      'min-w-0 flex-1 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                      isDraggingTypeFilters ? 'cursor-grabbing select-none' : 'cursor-grab',
                    ].join(' ')}
                  >
                    <div className="flex min-w-max items-center gap-2 pr-1">
                      {catalogTypeLabels.map((typeLabel) => {
                        const isSelected = selectedTypes.includes(typeLabel)

                        return (
                          <button
                            key={typeLabel}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleTypeToggle(typeLabel)}
                            className={[
                              'inline-flex shrink-0 items-center rounded-full border px-3.5 py-2 text-[0.72rem] font-semibold tracking-[0.16em] whitespace-nowrap uppercase transition',
                              isSelected
                                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                                : 'border-black/10 bg-[var(--surface-lowest)] text-[var(--secondary)] hover:border-black/20 hover:text-[var(--foreground)]',
                            ].join(' ')}
                          >
                            <span>{typeLabel}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label="Scroll type filters right"
                    onClick={() => handleTypeFiltersScroll('right')}
                    disabled={!canScrollTypeFiltersRight}
                    className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[var(--surface-lowest)] text-[var(--foreground)] transition hover:border-black/20 hover:bg-[var(--surface-high)] disabled:cursor-default disabled:opacity-35 sm:inline-flex"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      aria-hidden="true"
                    >
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mx-auto mt-4 flex max-w-[1136px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
            <div className="mt-8 rounded-[1.5rem] border border-[var(--ghost-border)] bg-[var(--surface-lowest)] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Loading public catalog
              </p>
              <p className="mt-2 text-sm text-[var(--secondary)]">
                {CATALOG_LOADING_MESSAGE}
              </p>
            </div>
          ) : !hasCatalogItems && catalogRefreshState === 'error' ? (
            <div className="mt-8 rounded-[1.5rem] border border-[#f2b7b7] bg-[#fff0f0] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[#8f1d1d]">
                Public catalog unavailable
              </p>
              <p className="mt-2 text-sm text-[#8f1d1d]/80">
                {catalogError ?? CATALOG_BLOCKING_ERROR_MESSAGE}
              </p>
            </div>
          ) : filteredItems.length ? (
            <>
              <div className="mx-auto mt-8 grid max-w-[1136px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {columnizedVisibleItems.map((columnItems, columnIndex) => (
                  <div
                    key={`catalog-column:${gridColumnCount}:${columnIndex}`}
                    className="flex flex-col gap-3"
                  >
                    {columnItems.map((item) => (
                      <ComponentCard
                        key={item.slug}
                        item={item}
                        copyState={getCopyState(copiedId, item.slug)}
                        onCopy={handleCopy}
                      />
                    ))}
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
