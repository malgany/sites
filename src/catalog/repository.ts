import rawLocalPreviewOverrides from './local-preview-overrides.json'
import { catalogManifest } from './manifest'
import type { CatalogCardItem, CatalogPreviewKind } from '../types'

export const CATALOG_TABLE = 'catalog_prompts'

type LocalPreviewOverride = {
  previewKind?: CatalogPreviewKind
  previewUrl?: string
  posterUrl?: string
  animatedPreviewUrl?: string
  animatedPreviewKind?: CatalogPreviewKind
  previewWidth?: number
  previewHeight?: number
  sourceUrl?: string
}

const localPreviewOverrides = rawLocalPreviewOverrides as Record<
  string,
  LocalPreviewOverride
>

type CatalogListRow = {
  slug: string
  title: string
  type_label: string
  preview_url: string | null
  preview_kind: CatalogPreviewKind | null
  is_public: boolean
  sort_order: number
}

type CatalogContentRow = {
  content_markdown: string
}

function isAnimatedImageUrl(url: string) {
  return /\.gif(?:$|\?)/i.test(url)
}

function isVideoUrl(url: string) {
  return /\.(?:mp4|webm|m4v|mov)(?:$|\?)/i.test(url)
}

function getRemotePreviewFields(
  previewUrl: string | null,
  previewKind: CatalogPreviewKind | null,
) {
  if (!previewUrl) {
    return {
      posterUrl: null,
      animatedPreviewUrl: null,
      animatedPreviewKind: null,
    }
  }

  if (previewKind === 'video' || isVideoUrl(previewUrl)) {
    return {
      posterUrl: null,
      animatedPreviewUrl: previewUrl,
      animatedPreviewKind: 'video' as const,
    }
  }

  if (isAnimatedImageUrl(previewUrl)) {
    return {
      posterUrl: null,
      animatedPreviewUrl: previewUrl,
      animatedPreviewKind: 'image' as const,
    }
  }

  return {
    posterUrl: previewUrl,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
  }
}

function mapStaticCatalogItem(
  slug: string,
  title: string,
  typeLabel: string,
): CatalogCardItem {
  const localPreviewOverride = localPreviewOverrides[slug]
  const animatedPreviewUrl =
    localPreviewOverride?.animatedPreviewUrl ??
    localPreviewOverride?.previewUrl ??
    null
  const animatedPreviewKind =
    localPreviewOverride?.animatedPreviewKind ??
    localPreviewOverride?.previewKind ??
    null

  return {
    slug,
    title,
    typeLabel,
    posterUrl: localPreviewOverride?.posterUrl ?? null,
    animatedPreviewUrl,
    animatedPreviewKind,
    previewWidth: localPreviewOverride?.previewWidth ?? null,
    previewHeight: localPreviewOverride?.previewHeight ?? null,
    isPublic: true,
  }
}

function mergeRemoteCatalogRow(
  item: CatalogCardItem,
  row: CatalogListRow | undefined,
): CatalogCardItem {
  if (!row) {
    return item
  }

  const remotePreview = getRemotePreviewFields(row.preview_url, row.preview_kind)

  return {
    ...item,
    posterUrl: item.posterUrl ?? remotePreview.posterUrl,
    animatedPreviewUrl: item.animatedPreviewUrl ?? remotePreview.animatedPreviewUrl,
    animatedPreviewKind:
      item.animatedPreviewKind ?? remotePreview.animatedPreviewKind,
  }
}

async function getBrowserSupabaseClient() {
  const clientModule = await import('./client')
  return clientModule.getBrowserSupabaseClient()
}

async function loadRemoteCatalogRows() {
  const supabase = await getBrowserSupabaseClient()
  const { data, error } = await supabase
    .from(CATALOG_TABLE)
    .select(
      'slug, title, type_label, preview_url, preview_kind, is_public, sort_order',
    )
    .eq('is_public', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(`Could not load public catalog: ${error.message}`)
  }

  return [...((data ?? []) as CatalogListRow[])].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }

    return left.title.localeCompare(right.title)
  })
}

export function getStaticCatalog() {
  return catalogManifest
    .filter((item) => item.visibility === 'public')
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }

      return left.title.localeCompare(right.title)
    })
    .map((item) => mapStaticCatalogItem(item.slug, item.title, item.typeLabel))
}

export async function refreshCatalogMetadata() {
  const staticCatalog = getStaticCatalog()
  const remoteRows = await loadRemoteCatalogRows()
  const rowMap = new Map(remoteRows.map((row) => [row.slug, row] as const))

  return staticCatalog.map((item) => mergeRemoteCatalogRow(item, rowMap.get(item.slug)))
}

export async function getCatalogContent(slug: string) {
  const supabase = await getBrowserSupabaseClient()
  const { data, error } = await supabase
    .from(CATALOG_TABLE)
    .select('content_markdown')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (error || !data) {
    throw new Error(`Could not load catalog content for "${slug}".`)
  }

  return (data as CatalogContentRow).content_markdown
}

export const listPublicCatalog = refreshCatalogMetadata
