import { createReadStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { loadEnvFiles } from './lib/catalog-supabase.mjs'
import {
  readPromptMediaLinks,
  upsertPromptMediaLink,
  writePromptMediaLinks,
} from './lib/prompt-media-links.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const promptMediaLinksPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'prompt-media-links.json',
)

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const usage = `
Usage:
  npm run upload:card-prompt-video -- \\
    --slug atelie-orbita \\
    --file C:\\media\\preview-v1.mp4

Required:
  --slug
  --file

Optional:
  --bucket
  --region
  --cloudfront-domain
  --s3-key (manual override)
  --dry-run
  --help

Default object key:
  cards/<slug>/prompt-video-<yyyymmdd-hhmmss>-<id>.mp4

Environment fallback:
  AWS_REGION
  AWS_S3_CARD_VIDEO_BUCKET
  AWS_CLOUDFRONT_DOMAIN
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_SESSION_TOKEN
`.trim()

function parseArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`)
    }

    const key = token.slice(2)

    if (key === 'dry-run' || key === 'help') {
      parsed[key] = true
      continue
    }

    const value = argv[index + 1]

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }

    parsed[key] = value
    index += 1
  }

  return parsed
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeCloudFrontDomain(value) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  return normalized
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/g, '')
}

function formatUtcTimestamp(date = new Date()) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}${month}${day}-${hour}${minute}${second}`
}

function generateDefaultS3Key({ filePath, slug }) {
  const extension = path.extname(filePath) || '.mp4'
  const timestamp = formatUtcTimestamp()
  const shortId = crypto.randomBytes(3).toString('hex')
  const fileName = `prompt-video-${timestamp}-${shortId}${extension.toLowerCase()}`

  return `cards/${slug}/${fileName}`
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(usage)
  process.exit(0)
}

const slug = normalizeString(args.slug)
const filePath = normalizeString(args.file)
const bucket =
  normalizeString(args.bucket) ?? normalizeString(process.env.AWS_S3_CARD_VIDEO_BUCKET)
const region =
  normalizeString(args.region) ?? normalizeString(process.env.AWS_REGION)
const cloudFrontDomain =
  normalizeCloudFrontDomain(args['cloudfront-domain']) ??
  normalizeCloudFrontDomain(process.env.AWS_CLOUDFRONT_DOMAIN)

if (!slug || !filePath) {
  throw new Error(`${usage}\n\n--slug and --file are required.`)
}

if (!bucket || !region || !cloudFrontDomain) {
  throw new Error(
    `${usage}\n\nMissing AWS_S3_CARD_VIDEO_BUCKET, AWS_REGION, or AWS_CLOUDFRONT_DOMAIN.`,
  )
}

const normalizedFilePath = path.resolve(filePath)
const fileName = path.basename(normalizedFilePath)
const s3Key =
  normalizeString(args['s3-key']) ??
  generateDefaultS3Key({ filePath: normalizedFilePath, slug })
const cloudFrontUrl = `https://${cloudFrontDomain}/${s3Key}`

let fileStats = null

if (!args['dry-run']) {
  fileStats = await fs.stat(normalizedFilePath)

  const s3 = new S3Client({ region })
  const upload = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: createReadStream(normalizedFilePath),
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=31536000, immutable',
  })

  await s3.send(upload)

  const links = await readPromptMediaLinks(promptMediaLinksPath)
  const nextLinks = upsertPromptMediaLink({
    cloudFrontUrl,
    fileBytes: fileStats.size,
    fileName,
    links,
    s3Key,
    slug,
  })

  await writePromptMediaLinks(promptMediaLinksPath, nextLinks)
}

console.log(
  JSON.stringify(
    {
      dryRun: Boolean(args['dry-run']),
      slug,
      filePath: normalizedFilePath,
      bucket,
      region,
      s3Key,
      cloudFrontDomain,
      cloudFrontUrl,
      promptMediaLinksPath,
      uploadedBytes: fileStats?.size ?? null,
    },
    null,
    2,
  ),
)
