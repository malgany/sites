import { useDeferredValue, useEffect, useState } from 'react'
import { CategoryTabs } from './components/CategoryTabs'
import { ComponentCard } from './components/ComponentCard'
import { categoryLabels, categoryOptions, componentItems } from './data/components'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import { filterComponents } from './lib/filterComponents'
import type { CategoryId, ComponentItem } from './types'

const ERROR_PREFIX = 'error:'

function getCopyState(copiedId: string | null, itemId: string) {
  if (copiedId === itemId) {
    return 'copied'
  }

  if (copiedId === `${ERROR_PREFIX}${itemId}`) {
    return 'error'
  }

  return 'idle'
}

function getLiveMessage(copiedId: string | null) {
  if (!copiedId) {
    return ''
  }

  return copiedId.startsWith(ERROR_PREFIX) ? 'Copy failed' : 'Prompt copied'
}

function App() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const totalCategories = categoryOptions.length - 1
  const activeCategoryLabel =
    activeCategory === 'all' ? 'All Sections' : categoryLabels[activeCategory]
  const popularCount = componentItems.filter(
    (item) => item.badge === 'Popular',
  ).length
  const newCount = componentItems.filter((item) => item.badge === 'New').length

  const deferredQuery = useDeferredValue(query)
  const filteredItems = filterComponents(
    componentItems,
    activeCategory,
    deferredQuery,
  )

  useEffect(() => {
    if (!copiedId) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setCopiedId(null)
    }, 2000)

    return () => window.clearTimeout(timer)
  }, [copiedId])

  async function handleCopy(item: ComponentItem) {
    const didCopy = await copyTextToClipboard(item.prompt)
    setCopiedId(didCopy ? item.id : `${ERROR_PREFIX}${item.id}`)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.06),transparent_28%),radial-gradient(circle_at_92%_16%,rgba(0,0,0,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(243,243,244,0.85)_44%,rgba(255,255,255,0.8)_100%)]" />
      <div className="pointer-events-none absolute left-[-14rem] top-[8rem] h-[22rem] w-[22rem] rounded-full bg-black/4 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[32rem] h-[18rem] w-[18rem] rounded-full bg-black/5 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1380px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <div className="sticky top-4 z-20">
          <div className="mx-auto flex items-center justify-between gap-4 rounded-[8px] border border-black/8 bg-white/72 px-4 py-3 backdrop-blur-[18px] shadow-[0_24px_48px_rgba(0,0,0,0.06)]">
            <div>
              <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-[var(--secondary)] uppercase">
                The Digital Curator
              </p>
              <p className="mt-1 text-sm font-medium tracking-[-0.02em] text-[var(--foreground)]">
                Prompt archive for React sections
              </p>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <a
                href="#library-panel"
                className="rounded-[6px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3 text-sm font-medium text-[var(--on-primary)] transition hover:brightness-110"
              >
                Browse collection
              </a>
              <a
                href="#component-grid-panel"
                className="rounded-[6px] bg-[var(--surface-high)] px-5 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-highest)]"
              >
                Jump to grid
              </a>
            </div>
          </div>
        </div>

        <header className="pb-10 pt-10 sm:pt-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end">
            <div>
              <p className="text-[0.72rem] font-semibold tracking-[0.24em] text-[var(--secondary)] uppercase">
                High-End Editorial System
              </p>
              <h1 className="mt-4 max-w-[11ch] text-[clamp(3.5rem,9vw,7rem)] leading-[0.9] font-black tracking-[-0.07em] text-[var(--foreground)] uppercase">
                Component Prompt Gallery
              </h1>

              <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
                <p className="max-w-[30rem] text-[0.95rem] leading-7 text-[var(--secondary)]">
                  Browse a curated archive of React + Tailwind prompt blocks
                  arranged like an editorial collection: oversized type, tonal
                  sections, compact metadata, and quick copy actions designed to
                  keep the browsing flow sharp.
                </p>

                <div className="space-y-4">
                  <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-[var(--secondary)] uppercase">
                    Curator note
                  </p>
                  <p className="text-[0.92rem] leading-6 text-[var(--foreground)]">
                    This layout favors breathing room over chrome. Sections are
                    separated by surface shifts, the header is intentionally
                    offset, and actions stay high contrast.
                  </p>
                </div>
              </div>
            </div>

            <aside className="rounded-[8px] bg-[var(--surface-low)] p-6">
              <p className="text-[0.72rem] font-semibold tracking-[0.18em] text-[var(--secondary)] uppercase">
                Archive status
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
                <div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--secondary)] uppercase">
                    Total prompts
                  </p>
                  <p className="mt-2 text-[2.2rem] leading-none font-semibold tracking-[-0.06em]">
                    {componentItems.length}
                  </p>
                </div>

                <div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--secondary)] uppercase">
                    Categories
                  </p>
                  <p className="mt-2 text-[2.2rem] leading-none font-semibold tracking-[-0.06em]">
                    {totalCategories}
                  </p>
                </div>

                <div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-[var(--secondary)] uppercase">
                    Featured picks
                  </p>
                  <p className="mt-2 text-[2.2rem] leading-none font-semibold tracking-[-0.06em]">
                    {popularCount + newCount}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </header>

        <section
          id="library-panel"
          className="rounded-[8px] bg-[var(--surface-low)] px-5 py-6 sm:px-6 sm:py-8"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end">
            <div>
              <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-[var(--secondary)] uppercase">
                Sections
              </p>
              <h2 className="mt-3 max-w-[12ch] text-[2rem] leading-[0.95] font-bold tracking-[-0.05em] text-[var(--foreground)]">
                Filter the archive by intent and browse at editorial scale.
              </h2>
              <div className="mt-6">
                <CategoryTabs
                  activeCategory={activeCategory}
                  onChange={setActiveCategory}
                />
              </div>
            </div>

            <label className="block">
              <span className="text-[0.72rem] font-semibold tracking-[0.2em] text-[var(--secondary)] uppercase">
                Search components or categories
              </span>

              <div className="mt-6 flex items-center gap-3 border-b border-[var(--outline)] pb-3 text-[var(--secondary)] transition focus-within:border-b-2 focus-within:border-[var(--primary)] focus-within:pb-[11px] focus-within:text-[var(--foreground)]">
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
                  placeholder="Search components or categories"
                  className="w-full border-none bg-transparent p-0 text-[0.95rem] text-[var(--foreground)] outline-none placeholder:text-[var(--secondary)]"
                />
              </div>
            </label>
          </div>
        </section>

        <section
          id="component-grid-panel"
          role="tabpanel"
          aria-labelledby={`tab-${activeCategory}`}
          className="mt-6 rounded-[8px] bg-[var(--surface-low)] px-5 py-6 sm:px-6 sm:py-8"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <p className="text-[0.72rem] font-semibold tracking-[0.18em] text-[var(--secondary)] uppercase">
                  Active view
                </p>
                <h2 className="mt-3 text-[1.8rem] leading-none font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  {activeCategoryLabel}
                </h2>
                <p className="mt-2 text-[0.92rem] text-[var(--secondary)]">
                  {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
                </p>
              </div>

              <p
                aria-live="polite"
                className="min-h-5 text-sm text-[var(--secondary)] sm:text-right"
              >
                {getLiveMessage(copiedId)}
              </p>
            </div>

            <p className="max-w-[18rem] text-[0.92rem] leading-6 text-[var(--secondary)]">
              Cards sit on a lowered surface so the previews lift by tonal
              contrast instead of heavy shadows.
            </p>
          </div>

          {filteredItems.length ? (
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ComponentCard
                  key={item.id}
                  item={item}
                  copyState={getCopyState(copiedId, item.id)}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-[var(--radius)] border border-[var(--ghost-border)] bg-[var(--surface-lowest)] px-6 py-12 text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                No components found
              </p>
              <p className="mt-2 text-sm text-[var(--secondary)]">
                Try a different search term or switch back to All.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
