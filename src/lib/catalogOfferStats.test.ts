import { describe, expect, it } from 'vitest'
import { getCatalogOfferStats } from './catalogOfferStats'
import type { CatalogCardItem } from '../types'

const item = (overrides: Partial<CatalogCardItem>): CatalogCardItem => ({
  slug: 'sample',
  title: 'Sample',
  typeLabel: 'Hero',
  posterUrl: null,
  animatedPreviewUrl: null,
  animatedPreviewKind: null,
  previewWidth: null,
  previewHeight: null,
  isPublic: true,
  requiredPlan: null,
  ...overrides,
})

describe('getCatalogOfferStats', () => {
  it('counts total, free, and premium catalog items', () => {
    expect(
      getCatalogOfferStats([
        item({ slug: 'free-1' }),
        item({ slug: 'free-2' }),
        item({ slug: 'premium-1', requiredPlan: 'premium' }),
      ]),
    ).toEqual({
      freeCount: 2,
      premiumCount: 1,
      totalCount: 3,
    })
  })
})

