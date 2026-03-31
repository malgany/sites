import type { CatalogCardLayout } from '../types'

const FEATURE_CARD_RATIO_THRESHOLD = 0.9

export function getCatalogCardLayout(
  width: number,
  height: number,
): CatalogCardLayout {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'compact'
  }

  return width / height < FEATURE_CARD_RATIO_THRESHOLD ? 'feature' : 'compact'
}
