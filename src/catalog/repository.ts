import type {
  CatalogCardItem,
  CatalogManifestReferenceLookup,
  CatalogPreviewKind,
} from '../types'
import { catalogManifest } from './manifest'
import { getLocalCatalogMedia } from './localMedia'

export const CATALOG_PUBLIC_VIEW = 'catalog_public_catalog'

const FULL_LIST_SELECT =
  'slug, title, type_label, reference_lookup, poster_url, preview_url, preview_kind, preview_width, preview_height, is_public, required_plan, sort_order'

type CatalogListRow = {
  slug: string
  title: string
  type_label: string
  reference_lookup?: CatalogManifestReferenceLookup | null
  poster_url?: string | null
  preview_url: string | null
  preview_kind: CatalogPreviewKind | null
  preview_width?: number | null
  preview_height?: number | null
  is_public: boolean
  required_plan?: string | null
  sort_order: number
}

type CatalogContentResponse = {
  contentMarkdown: string
}

const legacyTypeLabelBySlug = new Map(
  catalogManifest.map((item) => [item.slug, item.typeLabel]),
)
const manifestKeywordsBySlug = new Map(
  catalogManifest.map((item) => [
    item.slug,
    Array.isArray(item.referenceLookup?.keywords)
      ? item.referenceLookup.keywords.filter(
          (keyword): keyword is string =>
            typeof keyword === 'string' && Boolean(keyword.trim()),
        )
      : [],
  ]),
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
  const manifestKeywords = manifestKeywordsBySlug.get(row.slug) ?? []
  const legacyTypeLabel = legacyTypeLabelBySlug.get(row.slug)
  const keywords = Array.from(
    new Set([
      ...remoteKeywords,
      ...manifestKeywords,
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
    requiredPlan: row.required_plan ?? null,
  }
}

async function getBrowserSupabaseClient() {
  const clientModule = await import('./client')
  return clientModule.getBrowserSupabaseClient()
}

async function getBrowserAuthSupabaseClient() {
  const clientModule = await import('../auth/client')
  return clientModule.getBrowserAuthSupabaseClient()
}

async function loadRemoteCatalogRows() {
  const supabase = await getBrowserSupabaseClient()

  const response = await supabase
    .from(CATALOG_PUBLIC_VIEW)
    .select(FULL_LIST_SELECT)
    .order('sort_order', { ascending: true })

  if (response.error) {
    throw new Error(`Could not load catalog: ${response.error.message}`)
  }

  return [...((response.data ?? []) as unknown as CatalogListRow[])].sort((left, right) => {
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
  const supabase = await getBrowserAuthSupabaseClient()
  const sessionResponse = await supabase.auth.getSession()

  if (sessionResponse.error) {
    throw new Error(`Could not load the current auth session: ${sessionResponse.error.message}`)
  }

  const accessToken = sessionResponse.data.session?.access_token?.trim()
  const response = await supabase.functions.invoke<CatalogContentResponse>('catalog-content', {
    body: {
      slug,
    },
  })

  if (response.error || !response.data?.contentMarkdown) {
    throw new Error(`Could not load catalog content for "${slug}".`)
  }

  return response.data.contentMarkdown
}

export const listPublicCatalog = refreshCatalogMetadata
