import type { CatalogCardItem } from '../types'

export function filterCatalog(
  items: readonly CatalogCardItem[],
  query: string,
): CatalogCardItem[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return [...items]
  }

  return items.filter((item) => {
    const searchableText = `${item.title} ${item.typeLabel}`.toLowerCase()
    return searchableText.includes(normalizedQuery)
  })
}
