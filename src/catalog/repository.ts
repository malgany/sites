import { getBrowserSupabaseClient } from './client'
import rawLocalPreviewOverrides from './local-preview-overrides.json'
import type { CatalogCardItem, CatalogPreviewKind } from '../types'

export const CATALOG_TABLE = 'catalog_prompts'

type LocalPreviewOverride = {
  previewKind: CatalogPreviewKind
  previewUrl: string
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

function mapCatalogRowToCardItem(row: CatalogListRow): CatalogCardItem {
  const localPreviewOverride = localPreviewOverrides[row.slug]

  return {
    slug: row.slug,
    title: row.title,
    typeLabel: row.type_label,
    previewUrl: localPreviewOverride?.previewUrl ?? row.preview_url,
    previewKind:
      localPreviewOverride?.previewKind ?? row.preview_kind ?? 'image',
    isPublic: row.is_public,
  }
}

export async function listPublicCatalog() {
  const supabase = getBrowserSupabaseClient()
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

  return [...((data ?? []) as CatalogListRow[])]
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order
      }

      return left.title.localeCompare(right.title)
    })
    .map(mapCatalogRowToCardItem)
}

export async function getCatalogContent(slug: string) {
  const supabase = getBrowserSupabaseClient()
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
