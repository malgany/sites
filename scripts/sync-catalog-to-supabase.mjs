import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from '../src/catalog/catalog-manifest.json' with { type: 'json' }
import { createSourceHash, getAssetExtension, inferPreviewKindFromUrl, normalizeLookupValue, slugToStorageBasename } from './lib/catalog-sync-utils.mjs'
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

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const previewBucket =
  process.env.SUPABASE_PREVIEW_BUCKET?.trim() || 'catalog-previews'
const motionSitesSiteUrl =
  process.env.MOTIONSITES_SITE_URL?.trim() || DEFAULT_MOTIONSITES_SITE_URL

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for sync:catalog.',
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const snapshot = await fetchMotionSitesSiteCatalog({
  siteUrl: motionSitesSiteUrl,
})
const motionSitesClient = createMotionSitesPublicClient(snapshot)
const promptMap = await fetchMotionSitesPromptMap({
  client: motionSitesClient,
  promptIds: manifest.map(
    (item) => item.referenceLookup?.motionSitesSlug?.trim() || item.slug,
  ),
})
const motionSitesCatalog = snapshot.items

const summary = {
  deactivated: [],
  missingPreview: [],
  skippedMissingSite: [],
  skippedUnavailablePrompt: [],
  syncedCount: 0,
}

for (const item of manifest) {
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
  let previewUrl = null
  let previewKind = siteEntry.previewKind

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

  const { error } = await supabase.from('catalog_prompts').upsert(
    {
      slug: item.slug,
      title: item.title,
      type_label: item.typeLabel,
      content_markdown: promptDetails.promptText,
      is_public: item.visibility === 'public',
      preview_kind: previewKind,
      preview_url: previewUrl,
      published_at: item.visibility === 'public' ? new Date().toISOString() : null,
      required_plan: item.visibility === 'public' ? null : 'private',
      sort_order: item.sortOrder,
      source_file_name: `motionsites:${siteEntry.id}`,
      source_hash: createSourceHash(promptDetails.promptText),
    },
    {
      onConflict: 'slug',
    },
  )

  if (error) {
    throw new Error(`Supabase upsert failed for "${item.slug}": ${error.message}`)
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

async function loadEnvFiles(filePaths) {
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

  const slugCandidates = [
    item.referenceLookup?.motionSitesSlug?.trim(),
    item.slug,
  ].filter(Boolean)

  for (const slugCandidate of slugCandidates) {
    const directMatch = catalogEntries.find((entry) => entry.id === slugCandidate)

    if (directMatch) {
      return directMatch
    }
  }

  const referenceTitle = item.referenceLookup?.motionSitesTitle || item.title
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
  const { error } = await supabase
    .from('catalog_prompts')
    .update({
      is_public: false,
      published_at: null,
      required_plan: 'private',
    })
    .eq('slug', slug)

  if (error) {
    throw new Error(`Could not deactivate catalog prompt "${slug}": ${error.message}`)
  }
}
