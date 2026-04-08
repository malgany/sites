import { isPremiumCatalogItem } from './catalogAccess'
import type { CatalogCardItem } from '../types'

export type CatalogOfferStats = {
  freeCount: number
  premiumCount: number
  totalCount: number
}

export function getCatalogOfferStats(items: readonly CatalogCardItem[]): CatalogOfferStats {
  const totalCount = items.length
  const premiumCount = items.filter((item) => isPremiumCatalogItem(item)).length

  return {
    freeCount: totalCount - premiumCount,
    premiumCount,
    totalCount,
  }
}

