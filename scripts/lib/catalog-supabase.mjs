import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'

import { createSourceHash } from './catalog-sync-utils.mjs'

export const CATALOG_TABLE = 'catalog_prompts'

const FULL_INVENTORY_SELECT =
  'slug, title, type_label, sort_order, is_public, required_plan, published_at, poster_url, preview_url, preview_kind, preview_width, preview_height, reference_lookup'
const LEGACY_INVENTORY_SELECT =
  'slug, title, type_label, sort_order, is_public, required_plan, published_at, preview_url, preview_kind'

const VALID_PREFERRED_SOURCES = new Set([
  'lovable_templates',
  'motion_videos',
])

function trimString(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function normalizeKeywordList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(value.map((entry) => trimString(entry)).filter(Boolean)),
  )
}

export function normalizeCatalogReferenceLookup(value, fallbackTitle = null) {
  const referenceLookup =
    typeof value === 'object' && value !== null ? value : {}

  const normalizedLookup = {}
  const motionSitesSlug = trimString(referenceLookup.motionSitesSlug)
  const motionSitesTitle =
    trimString(referenceLookup.motionSitesTitle) ?? trimString(fallbackTitle)
  const preferredSource = trimString(referenceLookup.preferredSource)
  const keywords = normalizeKeywordList(referenceLookup.keywords)

  if (motionSitesSlug) {
    normalizedLookup.motionSitesSlug = motionSitesSlug
  }

  if (motionSitesTitle) {
    normalizedLookup.motionSitesTitle = motionSitesTitle
  }

  if (preferredSource && VALID_PREFERRED_SOURCES.has(preferredSource)) {
    normalizedLookup.preferredSource = preferredSource
  }

  if (keywords.length) {
    normalizedLookup.keywords = keywords
  }

  return normalizedLookup
}

export function getMotionSitesLookupSlug(item) {
  return trimString(item.referenceLookup?.motionSitesSlug) ?? item.slug
}

export function getMotionSitesReferenceTitle(item) {
  return trimString(item.referenceLookup?.motionSitesTitle) ?? item.title
}

export function mapCatalogInventoryRow(row) {
  return {
    slug: row.slug,
    title: row.title,
    typeLabel: row.type_label,
    sortOrder: row.sort_order,
    visibility: row.is_public ? 'public' : 'private',
    isPublic: row.is_public,
    requiredPlan: row.required_plan ?? null,
    publishedAt: row.published_at ?? null,
    posterUrl: row.poster_url ?? null,
    previewUrl: row.preview_url ?? null,
    previewKind: row.preview_kind ?? null,
    previewWidth: row.preview_width ?? null,
    previewHeight: row.preview_height ?? null,
    referenceLookup: normalizeCatalogReferenceLookup(
      row.reference_lookup,
      row.title,
    ),
  }
}

function isMissingCatalogColumnError(error) {
  return (
    typeof error?.message === 'string' &&
    error.message.includes(`column ${CATALOG_TABLE}.`) &&
    error.message.includes('does not exist')
  )
}

export async function loadCatalogInventory({ supabase }) {
  const fullQuery = supabase
    .from(CATALOG_TABLE)
    .select(FULL_INVENTORY_SELECT)
    .order('sort_order', { ascending: true })

  const { data, error } = await fullQuery

  if (error && !isMissingCatalogColumnError(error)) {
    throw new Error(`Could not load catalog inventory: ${error.message}`)
  }

  const legacyResponse = error
    ? await supabase
        .from(CATALOG_TABLE)
        .select(LEGACY_INVENTORY_SELECT)
        .order('sort_order', { ascending: true })
    : { data, error: null }

  if (legacyResponse.error) {
    throw new Error(
      `Could not load catalog inventory: ${legacyResponse.error.message}`,
    )
  }

  return [...(legacyResponse.data ?? [])]
    .map(mapCatalogInventoryRow)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }

      return left.title.localeCompare(right.title)
    })
}

export function buildCatalogUpsertPayload({
  item,
  localPreviewOverride,
  promptText,
  resolvedPreviewKind,
  resolvedPreviewUrl,
  siteEntry,
}) {
  const localPreviewUrl =
    localPreviewOverride?.animatedPreviewUrl ?? localPreviewOverride?.previewUrl ?? null
  const localPreviewKind =
    localPreviewOverride?.animatedPreviewKind ?? localPreviewOverride?.previewKind ?? null

  return {
    slug: item.slug,
    title: item.title,
    type_label: item.typeLabel,
    content_markdown: promptText,
    is_public: item.isPublic,
    poster_url: localPreviewOverride?.posterUrl ?? item.posterUrl ?? null,
    preview_kind:
      localPreviewKind ?? resolvedPreviewKind ?? item.previewKind ?? siteEntry.previewKind,
    preview_url: localPreviewUrl ?? resolvedPreviewUrl ?? item.previewUrl ?? null,
    preview_width:
      localPreviewOverride?.previewWidth ?? item.previewWidth ?? null,
    preview_height:
      localPreviewOverride?.previewHeight ?? item.previewHeight ?? null,
    published_at: item.publishedAt ?? null,
    required_plan: item.requiredPlan ?? null,
    reference_lookup: normalizeCatalogReferenceLookup(
      item.referenceLookup,
      item.title,
    ),
    sort_order: item.sortOrder,
    source_file_name: `motionsites:${siteEntry.id}`,
    source_hash: createSourceHash(promptText),
  }
}

export async function loadEnvFiles(filePaths) {
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      continue
    }

    const content = await fs.readFile(filePath, 'utf8')

    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) {
        continue
      }

      const separatorIndex = line.indexOf('=')

      if (separatorIndex < 1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()

      if (process.env[key] !== undefined) {
        continue
      }

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
}

export function getCatalogAdminEnv() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for catalog admin scripts.',
    )
  }

  return {
    serviceRoleKey,
    supabaseUrl,
  }
}

export function createCatalogAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getCatalogAdminEnv()

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
