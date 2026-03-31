import { describe, expect, it } from 'vitest'
import { getCatalogCardLayout } from './catalogCardLayout'

describe('getCatalogCardLayout', () => {
  it('keeps square and landscape previews in the compact card', () => {
    expect(getCatalogCardLayout(800, 800)).toBe('compact')
    expect(getCatalogCardLayout(800, 552)).toBe('compact')
  })

  it('promotes portrait previews to the taller card', () => {
    expect(getCatalogCardLayout(455, 800)).toBe('feature')
    expect(getCatalogCardLayout(385, 800)).toBe('feature')
  })

  it('falls back to the compact card for invalid dimensions', () => {
    expect(getCatalogCardLayout(0, 0)).toBe('compact')
    expect(getCatalogCardLayout(Number.NaN, 320)).toBe('compact')
  })
})
