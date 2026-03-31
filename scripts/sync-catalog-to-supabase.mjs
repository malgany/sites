import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createSourceHash,
  extractMediaUrls,
  getAssetExtension,
  inferPreviewKindFromUrl,
  normalizeLookupValue,
  resolveLatestSourceFile,
  slugToStorageBasename,
} from './lib/catalog-sync-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const manifestPath = path.join(repoRoot, 'src', 'catalog', 'catalog-manifest.json')
const defaultSourceDir = 'E:\\Projects\\hackzin\\output'
const defaultMotionSitesUrl = 'https://xgdzyqfalbibzelpdpvr.supabase.co'
const defaultMotionSitesAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZHp5cWZhbGJpYnplbHBkcHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzUwMDYsImV4cCI6MjA4NzQxMTAwNn0.u8lH5Y14xx2WxrNEBp8ngkJlijIYHJASq_gOzTaINZY'

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const sourceDir = process.env.CATALOG_SOURCE_DIR?.trim() || defaultSourceDir
const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const previewBucket =
  process.env.SUPABASE_PREVIEW_BUCKET?.trim() || 'catalog-previews'
const motionSitesUrl =
  process.env.MOTIONSITES_SUPABASE_URL?.trim() || defaultMotionSitesUrl
const motionSitesAnonKey =
  process.env.MOTIONSITES_SUPABASE_ANON_KEY?.trim() || defaultMotionSitesAnonKey

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for sync:catalog.',
  )
}

if (!existsSync(sourceDir)) {
  throw new Error(`Markdown source directory not found: ${sourceDir}`)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const motionSitesCatalog = await fetchMotionSitesCatalog({
  anonKey: motionSitesAnonKey,
  supabaseUrl: motionSitesUrl,
})

const summary = {
  fallbackPreviewCount: 0,
  missingPreviewCount: 0,
  motionSitesPreviewCount: 0,
  skippedMissingMarkdown: [],
  syncedCount: 0,
}

for (const item of manifest) {
  const sourceFile = await resolveLatestSourceFile(sourceDir, item.slug)

  if (!sourceFile) {
    summary.skippedMissingMarkdown.push(item.slug)
    continue
  }

  const contentMarkdown = await fs.readFile(sourceFile.absolutePath, 'utf8')
  const previewAsset = await resolvePreviewAsset({
    contentMarkdown,
    item,
    motionSitesCatalog,
  })

  let previewUrl = null
  let previewKind = 'image'

  if (previewAsset) {
    const uploadResult = await uploadPreviewAsset({
      asset: previewAsset,
      bucket: previewBucket,
      slug: item.slug,
      supabase,
    })

    previewUrl = uploadResult.publicUrl
    previewKind = uploadResult.previewKind

    if (previewAsset.source === 'motionsites') {
      summary.motionSitesPreviewCount += 1
    } else {
      summary.fallbackPreviewCount += 1
    }
  } else {
    summary.missingPreviewCount += 1
  }

  const { error } = await supabase.from('catalog_prompts').upsert(
    {
      slug: item.slug,
      title: item.title,
      type_label: item.typeLabel,
      content_markdown: contentMarkdown,
      is_public: item.visibility === 'public',
      preview_kind: previewKind,
      preview_url: previewUrl,
      published_at: item.visibility === 'public' ? new Date().toISOString() : null,
      required_plan: item.visibility === 'public' ? null : 'private',
      sort_order: item.sortOrder,
      source_file_name: sourceFile.name,
      source_hash: createSourceHash(contentMarkdown),
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
  `MotionSites previews: ${summary.motionSitesPreviewCount}. Fallback previews: ${summary.fallbackPreviewCount}. Missing previews: ${summary.missingPreviewCount}.`,
)

if (summary.skippedMissingMarkdown.length) {
  console.log(
    `Skipped ${summary.skippedMissingMarkdown.length} manifest entries without Markdown: ${summary.skippedMissingMarkdown.join(', ')}`,
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

async function fetchMotionSitesCatalog({ supabaseUrl, anonKey }) {
  try {
    const client = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const [templatesResult, videosResult] = await Promise.all([
      client
        .from('lovable_templates')
        .select('title, image_url, remix_link, is_premium'),
      client
        .from('motion_videos')
        .select('title, video_url, thumbnail_url, is_premium'),
    ])

    if (templatesResult.error || videosResult.error) {
      throw templatesResult.error ?? videosResult.error
    }

    const templateEntries = (templatesResult.data ?? [])
      .filter((entry) => entry.image_url)
      .map((entry) => ({
        assetUrl: entry.image_url,
        fallbackUrl: null,
        previewKind: inferPreviewKindFromUrl(entry.image_url),
        searchText: normalizeLookupValue(
          `${entry.title ?? ''} ${entry.remix_link ?? ''}`,
        ),
        source: 'lovable_templates',
        title: entry.title ?? '',
      }))

    const videoEntries = (videosResult.data ?? [])
      .filter((entry) => entry.video_url || entry.thumbnail_url)
      .map((entry) => ({
        assetUrl: entry.video_url ?? entry.thumbnail_url,
        fallbackUrl: entry.video_url ? entry.thumbnail_url : null,
        previewKind: entry.video_url ? 'video' : 'image',
        searchText: normalizeLookupValue(
          `${entry.title ?? ''} ${entry.video_url ?? ''} ${entry.thumbnail_url ?? ''}`,
        ),
        source: 'motion_videos',
        title: entry.title ?? '',
      }))

    return [...templateEntries, ...videoEntries]
  } catch (error) {
    console.warn(
      `MotionSites preview lookup unavailable. Falling back to Markdown media extraction. ${error instanceof Error ? error.message : ''}`.trim(),
    )
    return []
  }
}

async function resolvePreviewAsset({ item, motionSitesCatalog, contentMarkdown }) {
  const motionSitesMatch = findMotionSitesMatch(item, motionSitesCatalog)

  if (motionSitesMatch) {
    const downloadedAsset = await tryDownloadRemoteAsset({
      fallbackUrl: motionSitesMatch.fallbackUrl,
      previewKind: motionSitesMatch.previewKind,
      source: 'motionsites',
      url: motionSitesMatch.assetUrl,
    })

    if (downloadedAsset) {
      return downloadedAsset
    }
  }

  const mediaUrls = extractMediaUrls(contentMarkdown)

  for (const mediaUrl of mediaUrls) {
    const fallbackAsset = await buildFallbackPreviewFromMarkdownMedia(
      item.slug,
      mediaUrl,
    )

    if (fallbackAsset) {
      return fallbackAsset
    }
  }

  return null
}

function findMotionSitesMatch(item, catalogEntries) {
  if (!catalogEntries.length) {
    return null
  }

  const referenceTitle = item.referenceLookup?.motionSitesTitle || item.title
  const preferredSource = item.referenceLookup?.preferredSource
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

    if (entry.previewKind === 'video') {
      score += 1
    }

    if (preferredSource && entry.source === preferredSource) {
      score += 10
    }

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

async function buildFallbackPreviewFromMarkdownMedia(slug, mediaUrl) {
  if (inferPreviewKindFromUrl(mediaUrl) === 'image') {
    const imageAsset = await fetchBinaryAsset(mediaUrl)

    if (!imageAsset) {
      return null
    }

    return {
      ...imageAsset,
      previewKind: 'image',
      source: 'fallback',
    }
  }

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `catalog-preview-${slugToStorageBasename(slug)}-`),
  )
  const outputPath = path.join(
    tempDir,
    `${slugToStorageBasename(slug) || 'preview'}.jpg`,
  )

  try {
    await runCommand('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      mediaUrl,
      '-frames:v',
      '1',
      outputPath,
    ])

    const buffer = await fs.readFile(outputPath)

    return {
      buffer,
      contentType: 'image/jpeg',
      extension: 'jpg',
      previewKind: 'image',
      source: 'fallback',
    }
  } catch {
    return null
  } finally {
    await fs.rm(tempDir, { force: true, recursive: true })
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }

      reject(new Error(stderr || `${command} exited with code ${code}`))
    })
  })
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
