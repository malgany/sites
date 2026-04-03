import { describe, expect, it } from 'vitest'
import {
  buildCatalogTaxonomy,
  normalizeCatalogTypeLabel,
} from '../scripts/lib/catalog-taxonomy.mjs'

describe('catalog taxonomy', () => {
  it('normalizes obvious duplicate type labels', () => {
    expect(normalizeCatalogTypeLabel({ category: 'Hero Section', id: 'sample-hero' })).toBe(
      'Hero',
    )
    expect(normalizeCatalogTypeLabel({ typeLabel: 'HR SaaS', slug: 'sample-saas' })).toBe(
      'SaaS',
    )
    expect(normalizeCatalogTypeLabel({ typeLabel: 'Estudio', slug: 'sample-studio' })).toBe(
      'Agency',
    )
    expect(
      normalizeCatalogTypeLabel({
        typeLabel: 'Automacao de IA',
        slug: 'sample-automation',
      }),
    ).toBe('Automation')
  })

  it('supports slug-specific overrides for better categorization', () => {
    expect(
      normalizeCatalogTypeLabel({
        id: 'stellar-ai-hero',
        category: 'Hero Section',
      }),
    ).toBe('AI')
  })

  it('preserves the old label as a keyword when the visible type changes', () => {
    expect(
      buildCatalogTaxonomy({
        referenceLookup: {},
        slug: 'sample-studio-card',
        typeLabel: 'Studio',
      }),
    ).toEqual({
      keywords: ['Studio'],
      typeLabel: 'Agency',
    })
  })
})
