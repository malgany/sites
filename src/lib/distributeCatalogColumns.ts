import type { CatalogCardItem } from '../types'
import { getCatalogCardLayout } from './catalogCardLayout'

const SMALL_BREAKPOINT = 640
const LARGE_BREAKPOINT = 1024

function getCatalogCardHeightUnits(item: CatalogCardItem) {
  return getCatalogCardLayout(item.previewWidth ?? NaN, item.previewHeight ?? NaN) ===
    'feature'
    ? 2
    : 1
}

export function getCatalogGridColumnCount(viewportWidth: number) {
  if (!Number.isFinite(viewportWidth) || viewportWidth < SMALL_BREAKPOINT) {
    return 1
  }

  if (viewportWidth < LARGE_BREAKPOINT) {
    return 2
  }

  return 4
}

export function distributeCatalogItemsAcrossColumns(
  items: readonly CatalogCardItem[],
  columnCount: number,
) {
  const safeColumnCount = Math.max(1, Math.floor(columnCount) || 1)
  const columns = Array.from({ length: safeColumnCount }, () => [] as CatalogCardItem[])
  const columnHeights = Array.from({ length: safeColumnCount }, () => 0)

  for (const item of items) {
    let targetColumnIndex = 0

    for (let index = 1; index < safeColumnCount; index += 1) {
      if (columnHeights[index] < columnHeights[targetColumnIndex]) {
        targetColumnIndex = index
      }
    }

    columns[targetColumnIndex].push(item)
    columnHeights[targetColumnIndex] += getCatalogCardHeightUnits(item)
  }

  return columns
}
