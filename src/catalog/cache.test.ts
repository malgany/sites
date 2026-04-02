import { afterEach, describe, expect, it } from 'vitest'
import { CATALOG_CACHE_KEY, loadCachedCatalog, storeCachedCatalog } from './cache'
import type { CatalogCardItem } from '../types'

const cachedItem: CatalogCardItem = {
  slug: 'atelie-orbita',
  title: 'Atelie Orbita',
  typeLabel: 'Estudio',
  keywords: ['Estudio'],
  posterUrl: '/card-posters/atelie-orbita.webp',
  animatedPreviewUrl:
    'https://d39qrw7a9vnyeo.cloudfront.net/cards/atelie-orbita/preview-gif-20260402-201043-7a6984.gif',
  animatedPreviewKind: 'image',
  previewWidth: 480,
  previewHeight: 339,
  isPublic: true,
}

afterEach(() => {
  window.localStorage.clear()
})

describe('catalog cache', () => {
  it('stores and reads the cached catalog items', () => {
    storeCachedCatalog([cachedItem])

    expect(loadCachedCatalog()).toEqual([cachedItem])
  })

  it('ignores invalid cached payloads', () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ nope: true }))

    expect(loadCachedCatalog()).toEqual([])
  })
})
