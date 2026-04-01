import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type RefObject,
} from 'react'
import { getCatalogCardLayout } from '../lib/catalogCardLayout'
import type {
  CatalogCardItem,
  CatalogCardLayout,
  CatalogCopyState,
} from '../types'

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

type PreviewMediaProps = Pick<ComponentCardProps, 'item'> & {
  onMediaReady: (layout: CatalogCardLayout) => void
  shouldLoadAnimation: boolean
}

function getInitialLayout(item: CatalogCardItem) {
  return getCatalogCardLayout(item.previewWidth ?? NaN, item.previewHeight ?? NaN)
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches)

    syncPreference()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncPreference)
      return () => mediaQuery.removeEventListener('change', syncPreference)
    }

    mediaQuery.addListener(syncPreference)
    return () => mediaQuery.removeListener(syncPreference)
  }, [])

  return prefersReducedMotion
}

function useIsInView(targetRef: RefObject<HTMLElement | null>) {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const target = targetRef.current

    if (!target) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setIsInView(entries.some((entry) => entry.isIntersecting))
      },
      {
        rootMargin: '240px 0px',
        threshold: 0.2,
      },
    )

    observer.observe(target)

    return () => observer.disconnect()
  }, [targetRef])

  return isInView
}

function scheduleIdleActivation(callback: () => void) {
  if (typeof window === 'undefined') {
    return null
  }

  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 400 })
  }

  return window.setTimeout(callback, 180)
}

function cancelIdleActivation(handle: number | null) {
  if (handle === null || typeof window === 'undefined') {
    return
  }

  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle)
    return
  }

  window.clearTimeout(handle)
}

function PreviewMedia({
  item,
  onMediaReady,
  shouldLoadAnimation,
}: PreviewMediaProps) {
  const [hasAnimatedMediaError, setHasAnimatedMediaError] = useState(false)
  const [hasPosterError, setHasPosterError] = useState(false)

  useEffect(() => {
    setHasAnimatedMediaError(false)
    setHasPosterError(false)
  }, [item.animatedPreviewUrl, item.posterUrl, item.slug])

  const width = item.previewWidth ?? undefined
  const height = item.previewHeight ?? undefined
  const hasPoster = Boolean(item.posterUrl) && !hasPosterError
  const hasAnimatedPreview =
    shouldLoadAnimation &&
    Boolean(item.animatedPreviewUrl) &&
    !hasAnimatedMediaError

  if (hasAnimatedPreview) {
    if (item.animatedPreviewKind === 'video') {
      return (
        <video
          src={item.animatedPreviewUrl ?? undefined}
          poster={item.posterUrl ?? undefined}
          width={width}
          height={height}
          className="absolute inset-0 size-full object-cover object-top"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          onLoadedMetadata={(event) => {
            onMediaReady(
              getCatalogCardLayout(
                event.currentTarget.videoWidth,
                event.currentTarget.videoHeight,
              ),
            )
          }}
          onError={() => setHasAnimatedMediaError(true)}
        />
      )
    }

    return (
      <img
        src={item.animatedPreviewUrl ?? undefined}
        alt={`${item.title} preview`}
        width={width}
        height={height}
        className="absolute inset-0 size-full object-cover object-top"
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          onMediaReady(
            getCatalogCardLayout(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
            ),
          )
        }}
        onError={() => setHasAnimatedMediaError(true)}
      />
    )
  }

  if (hasPoster) {
    return (
      <img
        src={item.posterUrl ?? undefined}
        alt={`${item.title} preview`}
        width={width}
        height={height}
        className="absolute inset-0 size-full object-cover object-top"
        loading="lazy"
        decoding="async"
        onLoad={(event) => {
          onMediaReady(
            getCatalogCardLayout(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
            ),
          )
        }}
        onError={() => setHasPosterError(true)}
      />
    )
  }

  return (
    <div className="absolute inset-0 flex items-end bg-[linear-gradient(160deg,#121212,#343434_52%,#e6e6e6)] p-5 text-white">
      <div>
        <p className="text-[0.68rem] font-semibold tracking-[0.18em] uppercase text-white/70">
          {item.animatedPreviewUrl ? 'Poster only' : 'Preview pending'}
        </p>
        <p className="mt-3 max-w-[12ch] text-[1.4rem] leading-[0.95] font-semibold tracking-[-0.05em]">
          {item.title}
        </p>
      </div>
    </div>
  )
}

export function ComponentCard({
  item,
  copyState,
  onCopy,
}: ComponentCardProps) {
  const articleRef = useRef<HTMLElement | null>(null)
  const [layout, setLayout] = useState<CatalogCardLayout>(() => getInitialLayout(item))
  const [isHovered, setIsHovered] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const [shouldLoadAnimation, setShouldLoadAnimation] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const isInView = useIsInView(articleRef)

  useEffect(() => {
    setLayout(getInitialLayout(item))
    setIsHovered(false)
    setIsFocusWithin(false)
    setShouldLoadAnimation(false)
  }, [
    item.animatedPreviewKind,
    item.animatedPreviewUrl,
    item.posterUrl,
    item.previewHeight,
    item.previewWidth,
    item.slug,
  ])

  useEffect(() => {
    if (!item.animatedPreviewUrl || prefersReducedMotion) {
      setShouldLoadAnimation(false)
      return undefined
    }

    if (isHovered || isFocusWithin) {
      setShouldLoadAnimation(true)
      return undefined
    }

    if (!isInView) {
      setShouldLoadAnimation(false)
      return undefined
    }

    const handle = scheduleIdleActivation(() => {
      setShouldLoadAnimation(true)
    })

    return () => {
      cancelIdleActivation(handle)
    }
  }, [
    isFocusWithin,
    isHovered,
    isInView,
    item.animatedPreviewUrl,
    prefersReducedMotion,
  ])

  const buttonLabel =
    copyState === 'copied'
      ? 'Copied'
      : copyState === 'error'
        ? 'Copy failed'
        : copyState === 'pending'
          ? 'Copying'
          : 'Copy'

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const nextFocusedElement = event.relatedTarget

    if (
      nextFocusedElement instanceof Node &&
      event.currentTarget.contains(nextFocusedElement)
    ) {
      return
    }

    setIsFocusWithin(false)
  }

  return (
    <article
      ref={articleRef}
      className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-black/8 bg-[var(--surface-lowest)] shadow-[0_18px_40px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(0,0,0,0.08)]"
      role="article"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={handleBlur}
    >
      <div
        className={[
          'relative overflow-hidden bg-[var(--surface-high)]',
          layout === 'feature' ? 'aspect-[11/20]' : 'aspect-[4/3]',
        ].join(' ')}
      >
        <PreviewMedia
          key={`${item.slug}:${shouldLoadAnimation ? 'animated' : 'poster'}`}
          item={item}
          onMediaReady={setLayout}
          shouldLoadAnimation={shouldLoadAnimation}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(0,0,0,0.08)_100%)]" />
      </div>

      <div className="flex items-end justify-between gap-3 px-3 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[1.18rem] leading-[1.05] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {item.title}
          </h2>
          <p className="mt-2 text-[0.74rem] font-medium tracking-[0.14em] text-[var(--secondary)] uppercase">
            {item.typeLabel}
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
