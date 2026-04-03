import type { CatalogCardItem } from '../types'

export const PREMIUM_PLAN = 'premium'

export function isPremiumCatalogItem(item: Pick<CatalogCardItem, 'requiredPlan'>) {
  return typeof item.requiredPlan === 'string' && item.requiredPlan.trim().length > 0
}

export function getCatalogPricingHref(slug?: string | null) {
  if (!slug) {
    return '/pricing/'
  }

  const searchParams = new URLSearchParams({
    from: slug,
  })

  return `/pricing/?${searchParams.toString()}`
}
