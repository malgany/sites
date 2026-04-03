import { describe, expect, it } from 'vitest'
import type { CatalogCardItem } from '../types'
import {
  distributeCatalogItemsAcrossColumns,
  getCatalogGridColumnCount,
} from './distributeCatalogColumns'

const compactItem = (slug: string): CatalogCardItem => ({
  slug,
  title: slug,
  typeLabel: 'Demo',
  posterUrl: null,
  animatedPreviewUrl: null,
  animatedPreviewKind: null,
  previewWidth: 1200,
  previewHeight: 900,
  isPublic: true,
  requiredPlan: null,
})

const featureItem = (slug: string): CatalogCardItem => ({
  ...compactItem(slug),
  previewWidth: 455,
  previewHeight: 800,
})

describe('getCatalogGridColumnCount', () => {
  it('matches the app breakpoints', () => {
    expect(getCatalogGridColumnCount(0)).toBe(1)
    expect(getCatalogGridColumnCount(639)).toBe(1)
    expect(getCatalogGridColumnCount(640)).toBe(2)
    expect(getCatalogGridColumnCount(1023)).toBe(2)
    expect(getCatalogGridColumnCount(1024)).toBe(4)
  })
})

describe('distributeCatalogItemsAcrossColumns', () => {
  it('keeps the column heights balanced by card size', () => {
    const items = [
      compactItem('compact-a'),
      compactItem('compact-b'),
      featureItem('feature-a'),
      compactItem('compact-c'),
      compactItem('compact-d'),
      compactItem('compact-e'),
    ]
    const columns = distributeCatalogItemsAcrossColumns(
      items,
      4,
    )
    const columnHeights = columns.map((column) =>
      column.reduce(
        (total, item) => total + (item.previewHeight === 800 ? 2 : 1),
        0,
      ),
    )

    expect(columns.flat().map((item) => item.slug).sort()).toEqual(
      items.map((item) => item.slug).sort(),
    )
    expect(Math.max(...columnHeights) - Math.min(...columnHeights)).toBeLessThanOrEqual(1)
  })

  it('falls back to a single column for invalid column counts', () => {
    const items = [compactItem('compact-a'), featureItem('feature-a')]

    expect(distributeCatalogItemsAcrossColumns(items, 0)).toEqual([items])
  })
})
