import type { CategoryId, ComponentItem } from '../types'

export function filterComponents(
  items: readonly ComponentItem[],
  activeCategory: CategoryId,
  query: string,
): ComponentItem[] {
  const normalizedQuery = query.trim().toLowerCase()

  return items.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.category === activeCategory

    if (!matchesCategory) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const searchableText = `${item.title} ${item.category}`.toLowerCase()
    return searchableText.includes(normalizedQuery)
  })
}
