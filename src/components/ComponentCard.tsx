import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type RefObject,
} from 'react'
import { getCatalogCardLayout } from '../lib/catalogCardLayout'
import { isPremiumCatalogItem } from '../lib/catalogAccess'
import type {
  CatalogCardItem,
  CatalogCardLayout,
  CatalogCopyState,
} from '../types'

type ComponentCardProps = {
  hasPremiumAccess: boolean
  item: CatalogCardItem
  copyState: CatalogCopyState
  onCopy: (item: CatalogCardItem) => void
  pricingHref: string
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

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
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

function getMediaIdentity(item: CatalogCardItem) {
  return [
    item.slug,
    item.posterUrl ?? '',
    item.animatedPreviewUrl ?? '',
    item.previewWidth ?? '',
    item.previewHeight ?? '',
  ].join(':')
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
  const [isInView, setIsInView] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )

  useEffect(() => {
    const target = targetRef.current

    if (!target || typeof IntersectionObserver === 'undefined') {
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
  const [hasAnimatedMediaLoaded, setHasAnimatedMediaLoaded] = useState(false)

  const width = item.previewWidth ?? undefined
  const height = item.previewHeight ?? undefined
  const hasPoster = Boolean(item.posterUrl) && !hasPosterError
  const hasAnimatedPreview =
    shouldLoadAnimation &&
    Boolean(item.animatedPreviewUrl) &&
    !hasAnimatedMediaError

  const posterClassName = [
    'absolute inset-0 size-full object-cover object-top transition-opacity duration-200',
    hasAnimatedPreview && hasAnimatedMediaLoaded ? 'opacity-0' : 'opacity-100',
  ].join(' ')

  const animatedMediaClassName = [
    'absolute inset-0 size-full object-cover object-top transition-opacity duration-200',
    hasAnimatedMediaLoaded ? 'opacity-100' : 'opacity-0',
  ].join(' ')

  if (hasAnimatedPreview) {
    if (item.animatedPreviewKind === 'video') {
      return (
        <>
          {hasPoster ? (
            <img
              src={item.posterUrl ?? undefined}
              alt={`${item.title} preview`}
              width={width}
              height={height}
              draggable={false}
              className={posterClassName}
              loading="eager"
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
          ) : null}
          <video
            src={item.animatedPreviewUrl ?? undefined}
            poster={item.posterUrl ?? undefined}
            width={width}
            height={height}
            className={animatedMediaClassName}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            onLoadedData={(event) => {
              setHasAnimatedMediaLoaded(true)
              onMediaReady(
                getCatalogCardLayout(
                  event.currentTarget.videoWidth,
                  event.currentTarget.videoHeight,
                ),
              )
            }}
            onError={() => setHasAnimatedMediaError(true)}
          />
        </>
      )
    }

    return (
      <>
        {hasPoster ? (
          <img
            src={item.posterUrl ?? undefined}
            alt={`${item.title} preview`}
            width={width}
            height={height}
            draggable={false}
            className={posterClassName}
            loading="eager"
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
        ) : null}
        <img
          src={item.animatedPreviewUrl ?? undefined}
          alt={`${item.title} preview`}
          width={width}
          height={height}
          draggable={false}
          className={animatedMediaClassName}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            setHasAnimatedMediaLoaded(true)
            onMediaReady(
              getCatalogCardLayout(
                event.currentTarget.naturalWidth,
                event.currentTarget.naturalHeight,
              ),
            )
          }}
          onError={() => setHasAnimatedMediaError(true)}
        />
      </>
    )
  }

  if (hasPoster) {
    return (
      <img
        src={item.posterUrl ?? undefined}
        alt={`${item.title} preview`}
        width={width}
        height={height}
        draggable={false}
        className="absolute inset-0 size-full object-cover object-top"
        loading="eager"
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
    <div className="absolute inset-0 bg-[linear-gradient(160deg,#121212,#343434_52%,#e6e6e6)] p-5 text-white">
      <div className="flex h-full flex-col justify-between">
        <span className="inline-flex w-fit rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[0.62rem] font-semibold tracking-[0.18em] uppercase text-white/72">
          {item.animatedPreviewUrl ? 'Preview carregando' : 'Preview indisponivel'}
        </span>
        <div className="space-y-3">
          <div className="h-2.5 w-24 rounded-full bg-white/18" />
          <div className="h-2.5 w-36 rounded-full bg-white/12" />
        </div>
      </div>
    </div>
  )
}

export function ComponentCard({
  hasPremiumAccess,
  item,
  copyState,
  onCopy,
  pricingHref,
}: ComponentCardProps) {
  const articleRef = useRef<HTMLElement | null>(null)
  const [layout, setLayout] = useState<CatalogCardLayout>(() => getInitialLayout(item))
  const [isHovered, setIsHovered] = useState(false)
  const [isFocusWithin, setIsFocusWithin] = useState(false)
  const [hasIdleActivation, setHasIdleActivation] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const isInView = useIsInView(articleRef)
  const shouldLoadAnimation =
    Boolean(item.animatedPreviewUrl) &&
    !prefersReducedMotion &&
    (isHovered || isFocusWithin || (isInView && hasIdleActivation))

  useEffect(() => {
    if (
      !item.animatedPreviewUrl ||
      prefersReducedMotion ||
      isHovered ||
      isFocusWithin ||
      !isInView ||
      hasIdleActivation
    ) {
      return undefined
    }

    const handle = scheduleIdleActivation(() => {
      setHasIdleActivation(true)
    })

    return () => {
      cancelIdleActivation(handle)
    }
  }, [
    hasIdleActivation,
    isFocusWithin,
    isHovered,
    isInView,
    item.animatedPreviewUrl,
    prefersReducedMotion,
  ])

  const isPremium = isPremiumCatalogItem(item)
  const isPremiumLocked = isPremium && !hasPremiumAccess
  const buttonLabel =
    isPremiumLocked
      ? 'Premium'
      : copyState === 'copied'
        ? 'Copiado'
        : copyState === 'error'
          ? 'Falha ao copiar'
          : copyState === 'pending'
            ? 'Copiando'
            : 'Copiar'
  const actionClassName = [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition',
    isPremiumLocked
      ? 'border-transparent bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] text-[var(--on-primary)] hover:opacity-92'
      : 'disabled:cursor-wait disabled:opacity-80',
    !isPremiumLocked && copyState === 'copied'
      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
      : !isPremiumLocked && copyState === 'error'
        ? 'border-[#f2b7b7] bg-[#fff0f0] text-[#8f1d1d]'
        : !isPremiumLocked && copyState === 'pending'
          ? 'border-black/8 bg-[var(--surface-high)] text-[var(--foreground)]'
          : !isPremiumLocked
            ? 'border-black/8 bg-[var(--surface-low)] text-[var(--foreground)] hover:bg-[var(--surface-high)]'
            : '',
  ].join(' ')

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
      className="catalog-card group flex flex-col overflow-hidden rounded-[1.5rem] border border-black/8 bg-[var(--surface-lowest)] shadow-[0_18px_40px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_54px_rgba(0,0,0,0.08)]"
      role="article"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocusWithin(true)}
      onBlurCapture={handleBlur}
    >
      <div
        className={[
          'relative overflow-hidden bg-[var(--surface-high)]',
          layout === 'feature' ? 'catalog-card__media--feature' : 'aspect-[4/3]',
        ].join(' ')}
      >
        <PreviewMedia
          key={getMediaIdentity(item)}
          item={item}
          onMediaReady={setLayout}
          shouldLoadAnimation={shouldLoadAnimation}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(0,0,0,0.08)_100%)]" />
      </div>

      <div className="catalog-card__body flex items-end justify-between gap-3 px-3 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[1.18rem] leading-[1.05] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
            {item.title}
          </h2>
          <p className="mt-2 text-[0.74rem] font-medium tracking-[0.14em] text-[var(--secondary)] uppercase">
            {item.typeLabel}
          </p>
        </div>

        {isPremiumLocked ? (
          <a
            href={pricingHref}
            aria-label={`Ver plano premium: ${item.title}`}
            className={actionClassName}
          >
            <LockIcon />
            <span>{buttonLabel}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onCopy(item)}
            disabled={copyState === 'pending'}
            aria-label={`${buttonLabel}: ${item.title}`}
            className={actionClassName}
          >
            <CopyIcon />
            <span>{buttonLabel}</span>
          </button>
        )}
      </div>
    </article>
  )
}
