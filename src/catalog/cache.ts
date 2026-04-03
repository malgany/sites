import type { CatalogCardItem, CatalogPreviewKind } from '../types'

export const CATALOG_CACHE_KEY = 'catalog_prompts_cache_v2'

function isCatalogPreviewKind(value: unknown): value is CatalogPreviewKind | null {
  return value === null || value === 'image' || value === 'video'
}

function isCatalogCardItem(value: unknown): value is CatalogCardItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const item = value as Partial<CatalogCardItem>
  const hasValidKeywords =
    item.keywords === undefined ||
    (Array.isArray(item.keywords) &&
      item.keywords.every((keyword) => typeof keyword === 'string'))

  return (
    typeof item.slug === 'string' &&
    typeof item.title === 'string' &&
    typeof item.typeLabel === 'string' &&
    hasValidKeywords &&
    (typeof item.posterUrl === 'string' || item.posterUrl === null) &&
    (typeof item.animatedPreviewUrl === 'string' || item.animatedPreviewUrl === null) &&
    isCatalogPreviewKind(item.animatedPreviewKind) &&
    (typeof item.previewWidth === 'number' || item.previewWidth === null) &&
    (typeof item.previewHeight === 'number' || item.previewHeight === null) &&
    typeof item.isPublic === 'boolean' &&
    (typeof item.requiredPlan === 'string' || item.requiredPlan === null)
  )
}

export function loadCachedCatalog() {
  if (typeof window === 'undefined') {
    return [] as CatalogCardItem[]
  }

  try {
    const rawValue = window.localStorage.getItem(CATALOG_CACHE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    if (!Array.isArray(parsedValue) || !parsedValue.every(isCatalogCardItem)) {
      return []
    }

    return parsedValue
  } catch {
    return []
  }
}

export function storeCachedCatalog(items: readonly CatalogCardItem[]) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(items))
  } catch {
    // Ignore storage failures and keep the in-memory catalog working.
  }
}
