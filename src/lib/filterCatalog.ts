import type { CatalogCardItem } from '../types'

export function filterCatalog(
  items: readonly CatalogCardItem[],
  query: string,
  selectedTypes: readonly string[] = [],
): CatalogCardItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  const normalizedSelectedTypes = new Set(
    selectedTypes.map((typeLabel) => typeLabel.trim().toLowerCase()),
  )
  const hasSelectedTypes = normalizedSelectedTypes.size > 0

  if (!normalizedQuery && !hasSelectedTypes) {
    return [...items]
  }

  return items.filter((item) => {
    const searchableText = `${item.title} ${item.typeLabel} ${(item.keywords ?? []).join(' ')}`.toLowerCase()
    const matchesQuery =
      !normalizedQuery || searchableText.includes(normalizedQuery)
    const matchesType =
      !hasSelectedTypes ||
      normalizedSelectedTypes.has(item.typeLabel.trim().toLowerCase())

    return matchesQuery && matchesType
  })
}
