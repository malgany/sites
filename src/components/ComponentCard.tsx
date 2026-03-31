import { useState } from 'react'
import type { CatalogCardItem, CatalogCopyState } from '../types'

type ComponentCardProps = {
  item: CatalogCardItem
  copyState: CatalogCopyState
  onCopy: (item: CatalogCardItem) => void
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    </svg>
  )
}

function PreviewMedia({ item }: Pick<ComponentCardProps, 'item'>) {
  const [hasMediaError, setHasMediaError] = useState(false)

  if (!item.previewUrl || hasMediaError) {
    return (
      <div className="flex aspect-[4/5] items-end bg-[linear-gradient(160deg,#121212,#343434_52%,#e6e6e6)] p-5 text-white">
        <div>
          <p className="text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-white/70">
            Preview pending
          </p>
          <p className="mt-3 max-w-[12ch] text-[1.4rem] leading-[0.95] font-semibold tracking-[-0.05em]">
            {item.title}
          </p>
        </div>
      </div>
    )
  }

  if (item.previewKind === 'video') {
    return (
      <video
        src={item.previewUrl}
        className="aspect-[4/5] size-full object-cover object-top"
        autoPlay
        muted
        loop
        playsInline
        onError={() => setHasMediaError(true)}
      />
    )
  }

  return (
    <img
      src={item.previewUrl}
      alt={`${item.title} preview`}
      className="aspect-[4/5] size-full object-cover object-top"
      loading="lazy"
      onError={() => setHasMediaError(true)}
    />
  )
}

export function ComponentCard({
  item,
  copyState,
  onCopy,
}: ComponentCardProps) {
  const buttonLabel =
    copyState === 'copied'
      ? 'Copied'
      : copyState === 'error'
        ? 'Copy failed'
        : copyState === 'pending'
          ? 'Copying'
          : 'Copy markdown'

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-black/8 bg-[var(--surface-lowest)] shadow-[0_18px_40px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(0,0,0,0.08)]"
      role="article"
    >
      <div className="relative overflow-hidden bg-[var(--surface-high)]">
        <PreviewMedia
          key={`${item.previewKind}:${item.previewUrl ?? 'none'}`}
          item={item}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(0,0,0,0.08)_100%)]" />
        <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-white/70 bg-white/84 px-3 py-1 text-[0.66rem] font-semibold tracking-[0.18em] text-[var(--foreground)] uppercase shadow-[0_10px_24px_rgba(0,0,0,0.08)] backdrop-blur-md">
          {item.typeLabel}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="min-w-0">
          <h2 className="text-[1.18rem] leading-[1.05] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {item.title}
          </h2>
          <p className="mt-2 text-[0.74rem] font-medium tracking-[0.14em] text-[var(--secondary)] uppercase">
            {item.isPublic ? 'Public prompt' : 'Private prompt'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCopy(item)}
          disabled={copyState === 'pending'}
          aria-label={`${buttonLabel} for ${item.title}`}
          className={[
            'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-80',
            copyState === 'copied'
              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
              : copyState === 'error'
                ? 'border-[#f2b7b7] bg-[#fff0f0] text-[#8f1d1d]'
                : copyState === 'pending'
                  ? 'border-black/8 bg-[var(--surface-high)] text-[var(--foreground)]'
                  : 'border-black/8 bg-[var(--surface-low)] text-[var(--foreground)] hover:bg-[var(--surface-high)]',
          ].join(' ')}
        >
          <CopyIcon />
          <span>{buttonLabel}</span>
        </button>
      </div>
    </article>
  )
}
