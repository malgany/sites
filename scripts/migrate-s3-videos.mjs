/**
 * migrate-s3-videos.mjs
 *
 * Downloads all MP4 videos referenced in catalog_prompts.content_markdown
 * that still point to the old CloudFront domain (d8j0ntlcm91z4.cloudfront.net),
 * uploads them to the new S3 bucket, then updates Supabase with the new URLs.
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-s3-videos.mjs [--dry-run]
 */

import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createCatalogAdminClient, loadEnvFiles, CATALOG_TABLE } from './lib/catalog-supabase.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

// ── Constants ──────────────────────────────────────────────────────────────────

const OLD_CF_HOSTNAME = 'd8j0ntlcm91z4.cloudfront.net'
const OLD_CF_PREFIX   = `https://${OLD_CF_HOSTNAME}`

const NEW_BUCKET    = process.env.AWS_S3_CARD_VIDEO_BUCKET
const NEW_REGION    = process.env.AWS_REGION
let   NEW_CF_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN ?? ''
// strip protocol if someone added it
NEW_CF_DOMAIN = NEW_CF_DOMAIN.replace(/^https?:\/\//i, '').replace(/\/+$/, '')

const DRY_RUN = process.argv.includes('--dry-run')

if (!NEW_BUCKET || !NEW_REGION || !NEW_CF_DOMAIN) {
  console.error('Missing AWS_S3_CARD_VIDEO_BUCKET, AWS_REGION, or AWS_CLOUDFRONT_DOMAIN in env.')
  process.exit(1)
}

console.log('=== S3 Video Migration ===')
console.log('Old domain :', OLD_CF_HOSTNAME)
console.log('New bucket :', NEW_BUCKET)
console.log('New CF     :', NEW_CF_DOMAIN)
console.log('Dry-run    :', DRY_RUN)
console.log()

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUtcTimestamp(date = new Date()) {
  const y  = date.getUTCFullYear()
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d  = String(date.getUTCDate()).padStart(2, '0')
  const h  = String(date.getUTCHours()).padStart(2, '0')
  const mi = String(date.getUTCMinutes()).padStart(2, '0')
  const s  = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${mo}${d}-${h}${mi}${s}`
}

function generateS3Key(slug) {
  const timestamp = formatUtcTimestamp()
  const shortId   = crypto.randomBytes(3).toString('hex')
  return `cards/${slug}/prompt-video-${timestamp}-${shortId}.mp4`
}

/** Extract all unique old-domain mp4 URLs from a string of markdown */
function extractOldMp4Urls(markdown) {
  const matches = markdown.match(
    /https?:\/\/d8j0ntlcm91z4\.cloudfront\.net[^\s"'()<>]+?\.mp4/g,
  )
  return matches ? [...new Set(matches)] : []
}

/** Download a URL into a Buffer */
async function fetchBuffer(url) {
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${resp.status}`)
  }
  const arrayBuffer = await resp.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// ── Main ──────────────────────────────────────────────────────────────────────

const supabase = createCatalogAdminClient()

// 1. Fetch all rows
const { data: rows, error: fetchError } = await supabase
  .from(CATALOG_TABLE)
  .select('slug, content_markdown')

if (fetchError) {
  console.error('Could not load catalog_prompts:', fetchError.message)
  process.exit(1)
}

console.log(`Loaded ${rows.length} rows from catalog_prompts.`)

// 2. Build a mapping of OLD URL → NEW URL (deduplication across rows)
//    Also build per-slug list of affected rows
const oldToNew   = new Map() // oldUrl → newCfUrl
const slugMap    = new Map() // oldUrl → slug (for path convention; use first slug found)
const affectedRows = []

for (const row of rows) {
  const urls = extractOldMp4Urls(row.content_markdown ?? '')
  if (urls.length === 0) continue
  
  affectedRows.push(row)
  for (const u of urls) {
    if (!slugMap.has(u)) slugMap.set(u, row.slug)
  }
}

const uniqueOldUrls = [...slugMap.keys()]
console.log(`Found ${uniqueOldUrls.length} unique old-domain URLs across ${affectedRows.length} rows.`)
console.log()

// 3. Download + upload each unique URL
const s3 = new S3Client({ region: NEW_REGION })

for (let i = 0; i < uniqueOldUrls.length; i++) {
  const oldUrl = uniqueOldUrls[i]
  const slug   = slugMap.get(oldUrl)
  const s3Key  = generateS3Key(slug)
  const newUrl = `https://${NEW_CF_DOMAIN}/${s3Key}`

  console.log(`[${i + 1}/${uniqueOldUrls.length}] slug=${slug}`)
  console.log(`  OLD: ${oldUrl}`)
  console.log(`  NEW: ${newUrl}`)

  if (!DRY_RUN) {
    let buffer
    try {
      console.log('  Downloading…')
      buffer = await fetchBuffer(oldUrl)
      console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`)
    } catch (err) {
      console.error(`  ⚠️  Download failed: ${err.message} — skipping`)
      continue
    }

    try {
      console.log('  Uploading to S3…')
      await s3.send(new PutObjectCommand({
        Bucket:       NEW_BUCKET,
        Key:          s3Key,
        Body:         buffer,
        ContentType:  'video/mp4',
        CacheControl: 'public, max-age=31536000, immutable',
      }))
      console.log('  S3 upload complete.')
    } catch (err) {
      console.error(`  ⚠️  S3 upload failed: ${err.message} — skipping`)
      continue
    }
  }

  oldToNew.set(oldUrl, newUrl)
  console.log()
}

console.log(`Mapped ${oldToNew.size} URLs. Now updating Supabase…`)
console.log()

// 4. Update content_markdown for each affected row
let updatedCount = 0
let errorCount   = 0

for (const row of affectedRows) {
  const oldUrls = extractOldMp4Urls(row.content_markdown ?? '')
  if (oldUrls.length === 0) continue

  // Only update if we have a mapping for at least one URL in this row
  const hasMapping = oldUrls.some((u) => oldToNew.has(u))
  if (!hasMapping) {
    console.log(`  ⚠️  Skipping ${row.slug} — no successful mapping (likely download/upload failed)`)
    continue
  }

  let updatedContent = row.content_markdown
  for (const [oldUrl, newUrl] of oldToNew) {
    // Replace every occurrence (there may be duplicates within the same markdown)
    updatedContent = updatedContent.replaceAll(oldUrl, newUrl)
  }

  console.log(`Updating slug="${row.slug}"…`)
  
  if (!DRY_RUN) {
    const { error } = await supabase
      .from(CATALOG_TABLE)
      .update({ content_markdown: updatedContent })
      .eq('slug', row.slug)

    if (error) {
      console.error(`  ⚠️  Supabase update failed: ${error.message}`)
      errorCount++
      continue
    }
    console.log(`  ✓ Updated.`)
  } else {
    console.log(`  [dry-run] Would update content_markdown.`)
  }
  updatedCount++
}

// 5. Summary
console.log()
console.log('=== Migration Complete ===')
console.log(`Videos migrated : ${oldToNew.size} / ${uniqueOldUrls.length}`)
console.log(`Rows updated    : ${updatedCount}`)
console.log(`Errors          : ${errorCount}`)
if (DRY_RUN) console.log('(This was a dry-run — no changes were actually made.)')
