import { describe, expect, it } from 'vitest'
import { filterCatalog } from './filterCatalog'

const items = [
  {
    slug: 'aethera-hero',
    title: 'Aethera Studio',
    typeLabel: 'Studio',
    previewUrl: 'https://example.com/a.webp',
    previewKind: 'image',
    isPublic: true,
  },
  {
    slug: 'nexora-hero',
    title: 'Nexora Automation',
    typeLabel: 'Automation',
    previewUrl: 'https://example.com/nexora.mp4',
    previewKind: 'video',
    isPublic: true,
  },
  {
    slug: 'price-calculator',
    title: 'Price Calculator',
    typeLabel: 'Calculator',
    previewUrl: null,
    previewKind: 'image',
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
