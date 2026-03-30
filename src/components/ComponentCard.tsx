import { categoryLabels } from '../data/components'
import type { ComponentItem } from '../types'

type CardCopyState = 'idle' | 'copied' | 'error'

type ComponentCardProps = {
  item: ComponentItem
  copyState: CardCopyState
  onCopy: (item: ComponentItem) => void
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

function badgeClasses(badge: NonNullable<ComponentItem['badge']>) {
  return badge === 'Popular'
    ? 'bg-[var(--primary)] text-[var(--on-primary)]'
    : 'bg-[var(--surface-high)] text-[var(--secondary)]'
}

export function ComponentCard({
  item,
  copyState,
  onCopy,
}: ComponentCardProps) {
  const categoryLabel = categoryLabels[item.category]
  const buttonLabel =
    copyState === 'copied'
      ? 'Copied'
      : copyState === 'error'
        ? 'Copy failed'
        : 'Copy prompt'

  return (
    <article
      className="group flex h-full flex-col justify-between rounded-[var(--radius)] border border-[var(--ghost-border)] bg-[var(--surface-lowest)] p-3 transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,0,0,0.06)]"
      role="article"
    >
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius)-2px)] bg-[var(--surface-high)]">
          <img
            src={item.image}
            alt={`${item.title} preview`}
            className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(12,12,12,0.42)_100%)]" />
          <div className="absolute left-3 top-3 inline-flex items-center rounded-full border border-black/8 bg-white/70 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--foreground)] uppercase backdrop-blur-[16px]">
            {categoryLabel}
          </div>
        </div>

        <div className="space-y-4 px-1 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold tracking-[0.18em] text-[var(--secondary)] uppercase">
                React + Tailwind prompt
              </p>
              <h2 className="mt-2 text-[1.08rem] leading-[1.1] font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {item.title}
              </h2>
            </div>

            {item.badge ? (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.12em] uppercase ${badgeClasses(item.badge)}`}
              >
                {item.badge}
              </span>
            ) : null}
          </div>

          <p className="max-w-[34ch] text-[0.92rem] leading-6 text-[var(--secondary)]">
            {item.brief}
          </p>
        </div>
      </div>

      <div className="mt-6 px-1 pb-1">
        <button
          type="button"
          onClick={() => onCopy(item)}
          className={[
            'inline-flex w-full items-center justify-center gap-2 rounded-[6px] px-4 py-3 text-sm font-medium transition',
            copyState === 'copied'
              ? 'bg-[var(--primary)] text-[var(--on-primary)]'
              : copyState === 'error'
                ? 'bg-[#4a1515] text-[#f1dfdf]'
                : 'bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] text-[var(--on-primary)] hover:brightness-110',
          ].join(' ')}
        >
          <CopyIcon />
          <span>{buttonLabel}</span>
          <span className="sr-only"> for {item.title}</span>
        </button>
      </div>
    </article>
  )
}
