import rawLocalPreviewOverrides from './local-preview-overrides.json'

type LocalCatalogMedia = {
  animatedPreviewKind: 'image' | 'video' | null
  animatedPreviewUrl: string | null
  posterUrl: string | null
  previewHeight: number | null
  previewWidth: number | null
}

function normalizeString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizePreviewKind(value: unknown): LocalCatalogMedia['animatedPreviewKind'] {
  return value === 'image' || value === 'video' ? value : null
}

const localCatalogMediaBySlug = new Map(
  Object.entries(rawLocalPreviewOverrides).map(([slug, value]) => {
    const entry =
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : {}

    return [
      slug,
      {
        animatedPreviewKind: normalizePreviewKind(
          entry.animatedPreviewKind ?? entry.previewKind,
        ),
        animatedPreviewUrl:
          normalizeString(entry.animatedPreviewUrl) ??
          normalizeString(entry.previewUrl),
        posterUrl: normalizeString(entry.posterUrl),
        previewHeight: normalizeNumber(entry.previewHeight),
        previewWidth: normalizeNumber(entry.previewWidth),
      } satisfies LocalCatalogMedia,
    ]
  }),
)

export function getLocalCatalogMedia(slug: string) {
  return localCatalogMediaBySlug.get(slug) ?? null
}
