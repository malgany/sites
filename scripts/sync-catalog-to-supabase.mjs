import path from 'node:path'
import { fileURLToPath } from 'node:url'
import rawLocalPreviewOverrides from '../src/catalog/local-preview-overrides.json' with { type: 'json' }
import { getAssetExtension, inferPreviewKindFromUrl, normalizeLookupValue, slugToStorageBasename } from './lib/catalog-sync-utils.mjs'
import {
  buildCatalogUpsertPayload,
  createCatalogAdminClient,
  getMissingCatalogColumnName,
  getMotionSitesLookupSlug,
  getMotionSitesReferenceTitle,
  loadCatalogInventory,
  loadEnvFiles,
  upsertCatalogWithSchemaFallback,
} from './lib/catalog-supabase.mjs'
import {
  createMotionSitesPublicClient,
  DEFAULT_MOTIONSITES_SITE_URL,
  fetchMotionSitesPromptMap,
  fetchMotionSitesSiteCatalog,
} from './lib/motionsites-site-catalog.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const previewBucket =
  process.env.SUPABASE_PREVIEW_BUCKET?.trim() || 'catalog-previews'
const motionSitesSiteUrl =
  process.env.MOTIONSITES_SITE_URL?.trim() || DEFAULT_MOTIONSITES_SITE_URL

const supabase = createCatalogAdminClient()
const catalogInventory = await loadCatalogInventory({ supabase })

if (!catalogInventory.length) {
  throw new Error(
    'Catalog inventory is empty in Supabase. Create rows in public.catalog_prompts before running sync:catalog.',
  )
}

const snapshot = await fetchMotionSitesSiteCatalog({
  siteUrl: motionSitesSiteUrl,
})
const motionSitesClient = createMotionSitesPublicClient(snapshot)
const promptMap = await fetchMotionSitesPromptMap({
  client: motionSitesClient,
  promptIds: catalogInventory.map(getMotionSitesLookupSlug),
})
const motionSitesCatalog = snapshot.items
const localPreviewOverrides = rawLocalPreviewOverrides

const summary = {
  deactivated: [],
  missingPreview: [],
  skippedMissingSite: [],
  skippedUnavailablePrompt: [],
  syncedCount: 0,
  unsupportedColumns: new Set(),
}

for (const item of catalogInventory) {
  const siteEntry = findMotionSitesMatch(item, motionSitesCatalog)

  if (!siteEntry) {
    summary.skippedMissingSite.push(item.slug)
    await deactivateCatalogPrompt({
      slug: item.slug,
      supabase,
    })
    continue
  }

  const promptDetails = promptMap.get(siteEntry.id)

  if (!promptDetails?.promptText) {
    summary.skippedUnavailablePrompt.push(item.slug)
    await deactivateCatalogPrompt({
      slug: item.slug,
      supabase,
    })
    summary.deactivated.push(item.slug)
    continue
  }

  const previewAsset = await resolvePreviewAsset(siteEntry)
  const localPreviewOverride = localPreviewOverrides[item.slug] ?? null
  let previewUrl = item.previewUrl ?? null
  let previewKind = item.previewKind ?? siteEntry.previewKind

  if (previewAsset) {
    const uploadResult = await uploadPreviewAsset({
      asset: previewAsset,
      bucket: previewBucket,
      slug: item.slug,
      supabase,
    })

    previewUrl = uploadResult.publicUrl
    previewKind = uploadResult.previewKind
  } else {
    summary.missingPreview.push(item.slug)
  }

  const upsertPayload = buildCatalogUpsertPayload({
    item,
    localPreviewOverride,
    promptText: promptDetails.promptText,
    resolvedPreviewKind: previewKind,
    resolvedPreviewUrl: previewUrl,
    siteEntry,
  })
  const { unsupportedColumns } = await upsertCatalogWithSchemaFallback({
    payload: upsertPayload,
    supabase,
  })

  for (const column of unsupportedColumns) {
    summary.unsupportedColumns.add(column)
  }

  summary.syncedCount += 1
}

console.log(`Synced ${summary.syncedCount} catalog items to Supabase.`)
console.log(
  `Skipped unavailable prompts: ${summary.skippedUnavailablePrompt.length}. Missing site matches: ${summary.skippedMissingSite.length}. Missing previews: ${summary.missingPreview.length}.`,
)

if (summary.deactivated.length) {
  console.log(
    `Deactivated ${summary.deactivated.length} unavailable catalog rows: ${summary.deactivated.join(', ')}`,
  )
}

if (summary.unsupportedColumns.size) {
  console.log(
    `Skipped unsupported columns during upsert: ${Array.from(summary.unsupportedColumns).join(', ')}`,
  )
}

async function resolvePreviewAsset(siteEntry) {
  return tryDownloadRemoteAsset({
    fallbackUrl: siteEntry.posterUrl,
    previewKind: siteEntry.previewKind,
    source: 'motionsites',
    url: siteEntry.previewUrl,
  })
}

function findMotionSitesMatch(item, catalogEntries) {
  if (!catalogEntries.length) {
    return null
  }

  const slugCandidates = [getMotionSitesLookupSlug(item), item.slug].filter(Boolean)

  for (const slugCandidate of slugCandidates) {
    const directMatch = catalogEntries.find((entry) => entry.id === slugCandidate)

    if (directMatch) {
      return directMatch
    }
  }

  const referenceTitle = getMotionSitesReferenceTitle(item)
  const explicitKeywords = item.referenceLookup?.keywords ?? []
  const normalizedReferenceTitle = normalizeLookupValue(referenceTitle)
  const lookupTokens = Array.from(
    new Set(
      [
        ...normalizedReferenceTitle.split(' '),
        ...normalizeLookupValue(item.slug).split(' '),
        ...explicitKeywords.flatMap((keyword) =>
          normalizeLookupValue(keyword).split(' '),
        ),
      ].filter((token) => token.length >= 3),
    ),
  )

  let bestMatch = null

  for (const entry of catalogEntries) {
    let score = 0

    if (normalizeLookupValue(entry.title) === normalizedReferenceTitle) {
      score += 100
    }

    for (const token of lookupTokens) {
      if (entry.searchText.includes(token)) {
        score += 8
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { entry, score }
    }
  }

  return bestMatch && bestMatch.score >= 16 ? bestMatch.entry : null
}

async function tryDownloadRemoteAsset({ url, fallbackUrl, previewKind, source }) {
  const primaryDownload = await fetchBinaryAsset(url)

  if (primaryDownload) {
    return {
      ...primaryDownload,
      previewKind,
      source,
    }
  }

  if (!fallbackUrl) {
    return null
  }

  const fallbackDownload = await fetchBinaryAsset(fallbackUrl)

  if (!fallbackDownload) {
    return null
  }

  return {
    ...fallbackDownload,
    previewKind: inferPreviewKindFromUrl(fallbackUrl),
    source,
  }
}

async function fetchBinaryAsset(url) {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type')

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
      extension: getAssetExtension(url, contentType),
    }
  } catch {
    return null
  }
}

async function uploadPreviewAsset({ supabase, bucket, slug, asset }) {
  const objectPath = `cards/${slugToStorageBasename(slug) || 'preview'}.${asset.extension}`
  const { error } = await supabase.storage.from(bucket).upload(objectPath, asset.buffer, {
    cacheControl: '3600',
    contentType: asset.contentType ?? undefined,
    upsert: true,
  })

  if (error) {
    throw new Error(`Preview upload failed for "${slug}": ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(objectPath)

  return {
    previewKind: asset.previewKind,
    publicUrl,
  }
}

async function deactivateCatalogPrompt({ supabase, slug }) {
  const nextPayload = {
    is_active: false,
    published_at: null,
  }

  while (true) {
    const { error } = await supabase
      .from('catalog_prompts')
      .update(nextPayload)
      .eq('slug', slug)

    if (!error) {
      return
    }

    const missingColumn = getMissingCatalogColumnName(error)

    if (!missingColumn || !(missingColumn in nextPayload)) {
      throw new Error(`Could not deactivate catalog prompt "${slug}": ${error.message}`)
    }

    delete nextPayload[missingColumn]

    if (!Object.keys(nextPayload).length) {
      return
    }
  }
}
