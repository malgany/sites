import rawCatalogManifest from './catalog-manifest.json'
import type { CatalogManifestItem } from '../types'

function assertCatalogManifestItem(
  value: unknown,
  index: number,
): asserts value is CatalogManifestItem {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Catalog manifest entry ${index} is invalid.`)
  }

  const item = value as Partial<CatalogManifestItem>

  if (
    typeof item.slug !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.typeLabel !== 'string' ||
    typeof item.sortOrder !== 'number' ||
    (item.visibility !== 'public' && item.visibility !== 'private')
  ) {
    throw new Error(`Catalog manifest entry ${index} is missing required fields.`)
  }
}

const parsedManifest = rawCatalogManifest.map((entry, index) => {
  assertCatalogManifestItem(entry, index)
  return entry
})

const slugSet = new Set<string>()
const sortOrderSet = new Set<number>()

for (const item of parsedManifest) {
  if (slugSet.has(item.slug)) {
    throw new Error(`Duplicate catalog slug found in manifest: ${item.slug}`)
  }

  if (sortOrderSet.has(item.sortOrder)) {
    throw new Error(
      `Duplicate catalog sortOrder found in manifest: ${item.sortOrder}`,
    )
  }

  slugSet.add(item.slug)
  sortOrderSet.add(item.sortOrder)
}

export const catalogManifest: readonly CatalogManifestItem[] = parsedManifest
