import rawPreviewSiteLinks from './preview-site-links.json'

function normalizePreviewSiteUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const candidate = value.trim()

  if (!candidate) {
    return null
  }

  try {
    const parsedUrl = new URL(candidate)

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return null
    }

    return parsedUrl.toString()
  } catch {
    return null
  }
}

const previewSiteUrlBySlug = new Map(
  Object.entries(rawPreviewSiteLinks)
    .map(([slug, value]) => [slug, normalizePreviewSiteUrl(value)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
)

export function getCatalogPreviewSiteUrl(slug: string) {
  return previewSiteUrlBySlug.get(slug) ?? null
}

