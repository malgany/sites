import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { loadEnvFiles } from './lib/catalog-supabase.mjs'
import {
  readPreviewOverrides,
  upsertPreviewOverride,
  writePreviewOverrides,
} from './lib/preview-overrides.mjs'
import {
  readPreviewMediaLinks,
  upsertPreviewMediaLink,
  writePreviewMediaLinks,
} from './lib/preview-media-links.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const overridesPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'local-preview-overrides.json',
)
const previewMediaLinksPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'preview-media-links.json',
)
const posterOutputDir = path.join(repoRoot, 'public', 'card-posters')
const DEFAULT_GIF_MAX_WIDTH = 480
const DEFAULT_GIF_MAX_HEIGHT = 339
const DEFAULT_GIF_FPS = 10
const DEFAULT_GIF_COLORS = 96
const DEFAULT_GIF_DITHER_SCALE = 4
const POSTER_MAX_WIDTH = 640
const POSTER_QUALITY = 64

await loadEnvFiles([path.join(repoRoot, '.env'), path.join(repoRoot, '.env.local')])

const usage = `
Usage:
  npm run publish:card-preview-gif -- \\
    --slug atelie-orbita \\
    --gif-file C:\\media\\atelie-orbita.gif

Required:
  --slug
  --gif-file

Optional:
  --bucket
  --region
  --cloudfront-domain
  --s3-key (manual override)
  --max-width
  --max-height
  --gif-fps
  --gif-colors
  --gif-dither-scale
  --skip-gif-normalization
  --gif-effort
  --poster-quality
  --dry-run
  --help

Default object key:
  cards/<slug>/preview-gif-<yyyymmdd-hhmmss>-<id>.gif

Environment fallback:
  AWS_REGION
  AWS_S3_CARD_VIDEO_BUCKET
  AWS_CLOUDFRONT_DOMAIN
  FFMPEG_PATH
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_SESSION_TOKEN

Default GIF normalization before upload:
  max-width: 480
  max-height: 339
  fps: 10
  colors: 96
  dither-scale: 4
`.trim()

function parseArgs(argv) {
  const parsed = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`)
    }

    const key = token.slice(2)

    if (
      key === 'dry-run' ||
      key === 'help' ||
      key === 'skip-gif-normalization'
    ) {
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

function normalizePositiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeInteger(value, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return null
  }

  return parsed
}

function normalizeCloudFrontDomain(value) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return null
  }

  return normalized.replace(/^https?:\/\//i, '').replace(/\/+$/g, '')
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

function generateDefaultS3Key({ slug }) {
  const timestamp = formatUtcTimestamp()
  const shortId = crypto.randomBytes(3).toString('hex')

  return `cards/${slug}/preview-gif-${timestamp}-${shortId}.gif`
}

function resolveTargetDimensions({ width, height, maxWidth, maxHeight }) {
  let nextWidth = width
  let nextHeight = height

  if (maxWidth && nextWidth > maxWidth) {
    const scale = maxWidth / nextWidth
    nextWidth = maxWidth
    nextHeight = Math.round(nextHeight * scale)
  }

  if (maxHeight && nextHeight > maxHeight) {
    const scale = maxHeight / nextHeight
    nextHeight = maxHeight
    nextWidth = Math.round(nextWidth * scale)
  }

  return {
    width: nextWidth,
    height: nextHeight,
  }
}

function runCommand(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            `Could not find "${command}". Install ffmpeg or set FFMPEG_PATH to keep the default GIF compression profile.`,
          ),
        )
        return
      }

      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `"${command}" exited with code ${code}.${stderr.trim() ? `\n${stderr.trim()}` : ''}`,
        ),
      )
    })
  })
}

async function createSharpGifBuffer({
  gifFile,
  gifEffort,
  height,
  width,
}) {
  return sharp(gifFile, { animated: true })
    .resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .gif({ effort: gifEffort })
    .toBuffer()
}

async function createNormalizedGifBuffer({
  ffmpegPath,
  gifColors,
  gifDitherScale,
  gifFile,
  gifFps,
  height,
  width,
}) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'card-preview-gif-'))
  const outputPath = path.join(tempDir, 'normalized-preview.gif')
  const filter = [
    `fps=${gifFps},scale=${width}:${height}:flags=lanczos,split[s0][s1]`,
    `[s0]palettegen=max_colors=${gifColors}:stats_mode=diff[p]`,
    `[s1][p]paletteuse=dither=bayer:bayer_scale=${gifDitherScale}:diff_mode=rectangle`,
  ].join(';')

  try {
    await runCommand(ffmpegPath, [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      gifFile,
      '-filter_complex',
      filter,
      outputPath,
    ])

    return await fs.readFile(outputPath)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(usage)
  process.exit(0)
}

const slug = normalizeString(args.slug)
const gifFile = normalizeString(args['gif-file'])
const bucket =
  normalizeString(args.bucket) ?? normalizeString(process.env.AWS_S3_CARD_VIDEO_BUCKET)
const region = normalizeString(args.region) ?? normalizeString(process.env.AWS_REGION)
const cloudFrontDomain =
  normalizeCloudFrontDomain(args['cloudfront-domain']) ??
  normalizeCloudFrontDomain(process.env.AWS_CLOUDFRONT_DOMAIN)

if (!slug || !gifFile) {
  throw new Error(`${usage}\n\n--slug and --gif-file are required.`)
}

if (!bucket || !region || !cloudFrontDomain) {
  throw new Error(
    `${usage}\n\nMissing AWS_S3_CARD_VIDEO_BUCKET, AWS_REGION, or AWS_CLOUDFRONT_DOMAIN.`,
  )
}

const resolvedGifFile = path.resolve(gifFile)
const fileName = path.basename(resolvedGifFile)
const posterPublicUrl = `/card-posters/${slug}.webp`
const posterOutputPath = path.join(posterOutputDir, `${slug}.webp`)
const posterQuality =
  normalizePositiveNumber(args['poster-quality']) ?? POSTER_QUALITY
const gifEffort = normalizePositiveNumber(args['gif-effort']) ?? 7
const maxWidth =
  normalizePositiveNumber(args['max-width']) ?? DEFAULT_GIF_MAX_WIDTH
const maxHeight =
  normalizePositiveNumber(args['max-height']) ?? DEFAULT_GIF_MAX_HEIGHT
const gifFps = normalizeInteger(args['gif-fps']) ?? DEFAULT_GIF_FPS
const gifColors =
  normalizeInteger(args['gif-colors'], { min: 2, max: 256 }) ??
  DEFAULT_GIF_COLORS
const gifDitherScale =
  normalizeInteger(args['gif-dither-scale'], { min: 0, max: 5 }) ??
  DEFAULT_GIF_DITHER_SCALE
const skipGifNormalization = Boolean(args['skip-gif-normalization'])
const ffmpegPath = normalizeString(process.env.FFMPEG_PATH) ?? 'ffmpeg'
const s3Key = normalizeString(args['s3-key']) ?? generateDefaultS3Key({ slug })
const cloudFrontUrl = `https://${cloudFrontDomain}/${s3Key}`

const metadata = await sharp(resolvedGifFile, { animated: true }).metadata()
const sourceWidth = metadata.width
const sourceHeight = metadata.pageHeight ?? metadata.height

if (!sourceWidth || !sourceHeight) {
  throw new Error(`Could not detect GIF dimensions for "${resolvedGifFile}".`)
}

const targetDimensions = resolveTargetDimensions({
  width: sourceWidth,
  height: sourceHeight,
  maxWidth,
  maxHeight,
})
const shouldResizeGif =
  targetDimensions.width !== sourceWidth || targetDimensions.height !== sourceHeight

const gifBuffer = skipGifNormalization
  ? await createSharpGifBuffer({
      gifEffort,
      gifFile: resolvedGifFile,
      height: targetDimensions.height,
      width: targetDimensions.width,
    })
  : await createNormalizedGifBuffer({
      ffmpegPath,
      gifColors,
      gifDitherScale,
      gifFile: resolvedGifFile,
      gifFps,
      height: targetDimensions.height,
      width: targetDimensions.width,
    })
const uploadedBytes = gifBuffer.byteLength

if (!args['dry-run']) {
  await fs.mkdir(posterOutputDir, { recursive: true })

  const s3 = new S3Client({ region })
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: gifBuffer,
      ContentType: 'image/gif',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )

  await sharp(resolvedGifFile, { animated: true, page: 0, pages: 1 })
    .resize({
      width: targetDimensions.width,
      height: targetDimensions.height,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .resize({ width: POSTER_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: posterQuality, effort: 6 })
    .toFile(posterOutputPath)

  const rawOverrides = await readPreviewOverrides(overridesPath)
  const nextOverrides = upsertPreviewOverride({
    overrides: rawOverrides,
    slug,
    posterUrl: posterPublicUrl,
    previewHeight: targetDimensions.height,
    previewKind: 'image',
    previewUrl: cloudFrontUrl,
    previewWidth: targetDimensions.width,
    sourceUrl: cloudFrontUrl,
  })

  await writePreviewOverrides(overridesPath, nextOverrides)

  const rawLinks = await readPreviewMediaLinks(previewMediaLinksPath)
  const nextLinks = upsertPreviewMediaLink({
    cloudFrontUrl,
    fileBytes: uploadedBytes,
    fileName,
    links: rawLinks,
    originalHeight: sourceHeight,
    originalWidth: sourceWidth,
    previewHeight: targetDimensions.height,
    previewWidth: targetDimensions.width,
    s3Key,
    slug,
  })

  await writePreviewMediaLinks(previewMediaLinksPath, nextLinks)
}

console.log(
  JSON.stringify(
    {
      dryRun: Boolean(args['dry-run']),
      slug,
      gifFile: resolvedGifFile,
      bucket,
      region,
      s3Key,
      cloudFrontDomain,
      cloudFrontUrl,
      posterPublicUrl,
      originalWidth: sourceWidth,
      originalHeight: sourceHeight,
      previewWidth: targetDimensions.width,
      previewHeight: targetDimensions.height,
      resized: shouldResizeGif,
      skipGifNormalization,
      gifFps,
      gifColors,
      gifDitherScale,
      ffmpegPath: skipGifNormalization ? null : ffmpegPath,
      maxWidth,
      maxHeight,
      uploadedBytes,
      overridesPath,
      previewMediaLinksPath,
    },
    null,
    2,
  ),
)
