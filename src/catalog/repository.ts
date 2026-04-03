import type {
  CatalogCardItem,
  CatalogManifestReferenceLookup,
  CatalogPreviewKind,
} from '../types'
import { catalogManifest } from './manifest'
import { getLocalCatalogMedia } from './localMedia'

export const CATALOG_TABLE = 'catalog_prompts'

const FULL_LIST_SELECT =
  'slug, title, type_label, reference_lookup, poster_url, preview_url, preview_kind, preview_width, preview_height, is_active, is_public, sort_order'
const ACTIVE_LEGACY_LIST_SELECT =
  'slug, title, type_label, preview_url, preview_kind, is_active, is_public, sort_order'
const LEGACY_LIST_SELECT =
  'slug, title, type_label, preview_url, preview_kind, is_public, sort_order'

type CatalogListRow = {
  slug: string
  title: string
  type_label: string
  reference_lookup?: CatalogManifestReferenceLookup | null
  poster_url?: string | null
  preview_url: string | null
  preview_kind: CatalogPreviewKind | null
  is_active?: boolean | null
  preview_width?: number | null
  preview_height?: number | null
  is_public: boolean
  sort_order: number
}

type CatalogContentRow = {
  content_markdown: string
}

const legacyTypeLabelBySlug = new Map(
  catalogManifest.map((item) => [item.slug, item.typeLabel]),
)

function isAnimatedImageUrl(url: string) {
  return /\.gif(?:$|\?)/i.test(url)
}

function isVideoUrl(url: string) {
  return /\.(?:mp4|webm|m4v|mov)(?:$|\?)/i.test(url)
}

function getRemotePreviewFields(
  posterUrl: string | null,
  previewUrl: string | null,
  previewKind: CatalogPreviewKind | null,
) {
  if (!previewUrl) {
    return {
      posterUrl,
      animatedPreviewUrl: null,
      animatedPreviewKind: null,
    }
  }

  if (previewKind === 'video' || isVideoUrl(previewUrl)) {
    return {
      posterUrl,
      animatedPreviewUrl: previewUrl,
      animatedPreviewKind: 'video' as const,
    }
  }

  if (isAnimatedImageUrl(previewUrl)) {
    return {
      posterUrl,
      animatedPreviewUrl: previewUrl,
      animatedPreviewKind: 'image' as const,
    }
  }

  return {
    posterUrl: posterUrl ?? previewUrl,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
  }
}

function mapRemoteCatalogRow(row: CatalogListRow): CatalogCardItem {
  const localMedia = getLocalCatalogMedia(row.slug)
  const remoteKeywords = Array.isArray(row.reference_lookup?.keywords)
    ? row.reference_lookup.keywords.filter(
        (keyword): keyword is string => typeof keyword === 'string' && Boolean(keyword.trim()),
      )
    : []
  const legacyTypeLabel = legacyTypeLabelBySlug.get(row.slug)
  const keywords = Array.from(
    new Set([
      ...remoteKeywords,
      ...(legacyTypeLabel && legacyTypeLabel !== row.type_label
        ? [legacyTypeLabel]
        : []),
    ]),
  )
  const remotePreview = getRemotePreviewFields(
    localMedia?.posterUrl ?? row.poster_url ?? null,
    localMedia?.animatedPreviewUrl ?? row.preview_url,
    localMedia?.animatedPreviewKind ?? row.preview_kind,
  )

  return {
    slug: row.slug,
    title: row.title,
    typeLabel: row.type_label,
    ...(keywords.length ? { keywords } : {}),
    posterUrl: remotePreview.posterUrl,
    animatedPreviewUrl: remotePreview.animatedPreviewUrl,
    animatedPreviewKind: remotePreview.animatedPreviewKind,
    previewWidth: localMedia?.previewWidth ?? row.preview_width ?? null,
    previewHeight: localMedia?.previewHeight ?? row.preview_height ?? null,
    isPublic: row.is_public,
  }
}

async function getBrowserSupabaseClient() {
  const clientModule = await import('./client')
  return clientModule.getBrowserSupabaseClient()
}

function isMissingCatalogColumnError(message: string) {
  return (
    (message.includes(`column ${CATALOG_TABLE}.`) &&
      message.includes('does not exist')) ||
    (message.includes(`column of '${CATALOG_TABLE}' in the schema cache`) &&
      message.includes('Could not find'))
  )
}

async function loadRemoteCatalogRows() {
  const supabase = await getBrowserSupabaseClient()
  const fullQuery = supabase
    .from(CATALOG_TABLE)
    .select(FULL_LIST_SELECT)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  const { data, error } = await fullQuery

  if (error && !isMissingCatalogColumnError(error.message)) {
    throw new Error(`Could not load public catalog: ${error.message}`)
  }

  if (!error) {
    return [...((data ?? []) as CatalogListRow[])].sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order
      }

      return left.title.localeCompare(right.title)
    })
  }

  const activeFallbackResponse = await supabase
    .from(CATALOG_TABLE)
    .select(ACTIVE_LEGACY_LIST_SELECT)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (activeFallbackResponse.error && !isMissingCatalogColumnError(activeFallbackResponse.error.message)) {
    throw new Error(`Could not load public catalog: ${activeFallbackResponse.error.message}`)
  }

  const fallbackResponse = activeFallbackResponse.error
    ? await supabase
        .from(CATALOG_TABLE)
        .select(LEGACY_LIST_SELECT)
        .eq('is_public', true)
        .order('sort_order', { ascending: true })
    : activeFallbackResponse

  if (fallbackResponse.error) {
    throw new Error(`Could not load public catalog: ${fallbackResponse.error.message}`)
  }

  return [...((fallbackResponse.data ?? []) as CatalogListRow[])].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }

    return left.title.localeCompare(right.title)
  })
}

export async function refreshCatalogMetadata() {
  const remoteRows = await loadRemoteCatalogRows()

  return remoteRows.map(mapRemoteCatalogRow)
}

export async function getCatalogContent(slug: string) {
  const supabase = await getBrowserSupabaseClient()
  const activeQuery = supabase
    .from(CATALOG_TABLE)
    .select('content_markdown')
    .eq('slug', slug)
    .eq('is_public', true)
    .eq('is_active', true)
    .single()

  const { data, error } = await activeQuery

  if (error && !isMissingCatalogColumnError(error.message)) {
    throw new Error(`Could not load catalog content for "${slug}".`)
  }

  const fallbackResponse = error
    ? await supabase
        .from(CATALOG_TABLE)
        .select('content_markdown')
        .eq('slug', slug)
        .eq('is_public', true)
        .single()
    : { data, error: null }

  if (fallbackResponse.error || !fallbackResponse.data) {
    throw new Error(`Could not load catalog content for "${slug}".`)
  }

  return (fallbackResponse.data as CatalogContentRow).content_markdown
}

export const listPublicCatalog = refreshCatalogMetadata
