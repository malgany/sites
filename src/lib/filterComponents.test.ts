import { describe, expect, it } from 'vitest'
import { componentItems } from '../data/components'
import { filterComponents } from './filterComponents'

describe('filterComponents', () => {
  it('returns all items when the all tab is active and query is empty', () => {
    expect(filterComponents(componentItems, 'all', '')).toHaveLength(21)
  })

  it('filters by category', () => {
    const filtered = filterComponents(componentItems, 'pricing', '')

    expect(filtered).toHaveLength(3)
    expect(filtered.every((item) => item.category === 'pricing')).toBe(true)
  })

  it('matches query against title and category, ignoring case', () => {
    expect(filterComponents(componentItems, 'all', 'portfolio')).toHaveLength(1)
    expect(filterComponents(componentItems, 'all', 'FAQ')).toHaveLength(3)
  })

  it('combines the active category with the search query', () => {
    const filtered = filterComponents(componentItems, 'hero', 'agency')

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.title).toBe('Agency Spotlight Hero')
  })
})
