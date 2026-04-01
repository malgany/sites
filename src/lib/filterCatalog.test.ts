import { describe, expect, it } from 'vitest'
import { filterCatalog } from './filterCatalog'

const items = [
  {
    slug: 'aethera-hero',
    title: 'Aethera Studio',
    typeLabel: 'Studio',
    posterUrl: 'https://example.com/a.webp',
    animatedPreviewUrl: 'https://example.com/a.gif',
    animatedPreviewKind: 'image',
    previewWidth: 1200,
    previewHeight: 1600,
    isPublic: true,
  },
  {
    slug: 'nexora-hero',
    title: 'Nexora Automation',
    typeLabel: 'Automation',
    posterUrl: 'https://example.com/nexora.webp',
    animatedPreviewUrl: 'https://example.com/nexora.mp4',
    animatedPreviewKind: 'video',
    previewWidth: 1280,
    previewHeight: 720,
    isPublic: true,
  },
  {
    slug: 'price-calculator',
    title: 'Price Calculator',
    typeLabel: 'Calculator',
    posterUrl: null,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
    previewWidth: null,
    previewHeight: null,
    isPublic: true,
  },
] as const

describe('filterCatalog', () => {
  it('returns all items when the query is empty', () => {
    expect(filterCatalog(items, '')).toHaveLength(3)
  })

  it('matches the title case-insensitively', () => {
    expect(filterCatalog(items, 'aethera')).toEqual([items[0]])
  })

  it('matches the type label case-insensitively', () => {
    expect(filterCatalog(items, 'AUTOMATION')).toEqual([items[1]])
  })
})
