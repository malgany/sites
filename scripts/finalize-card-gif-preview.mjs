import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import {
  readPreviewOverrides,
  upsertPreviewOverride,
  writePreviewOverrides,
} from './lib/preview-overrides.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const overridesPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'local-preview-overrides.json',
)
const gifOutputDir = path.join(repoRoot, 'public', 'card-gifs')
const posterOutputDir = path.join(repoRoot, 'public', 'card-posters')
const POSTER_MAX_WIDTH = 640
const POSTER_QUALITY = 64

const usage = `
Usage:
  npm run finalize:card-gif-preview -- \\
    --slug atelie-orbita \\
    --gif-file C:\\media\\atelie-orbita.gif \\
    --max-width 720 \\
    --max-height 540

Required:
  --slug
  --gif-file

Optional:
  --max-width
  --max-height
  --gif-effort
  --poster-quality
  --dry-run
  --help
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

function normalizePositiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
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

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(usage)
  process.exit(0)
}

const slug = normalizeString(args.slug)
const gifFile = normalizeString(args['gif-file'])

if (!slug || !gifFile) {
  throw new Error(`${usage}\n\n--slug and --gif-file are required.`)
}

const resolvedGifFile = path.resolve(gifFile)
const gifPublicUrl = `/card-gifs/${slug}.gif`
const posterPublicUrl = `/card-posters/${slug}.webp`
const gifOutputPath = path.join(gifOutputDir, `${slug}.gif`)
const posterOutputPath = path.join(posterOutputDir, `${slug}.webp`)
const posterQuality =
  normalizePositiveNumber(args['poster-quality']) ?? POSTER_QUALITY
const gifEffort = normalizePositiveNumber(args['gif-effort']) ?? 7
const maxWidth = normalizePositiveNumber(args['max-width'])
const maxHeight = normalizePositiveNumber(args['max-height'])

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

if (!args['dry-run']) {
  await fs.mkdir(gifOutputDir, { recursive: true })
  await fs.mkdir(posterOutputDir, { recursive: true })
  if (shouldResizeGif) {
    await sharp(resolvedGifFile, { animated: true })
      .resize({
        width: targetDimensions.width,
        height: targetDimensions.height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .gif({ effort: gifEffort })
      .toFile(gifOutputPath)
  } else {
    await fs.copyFile(resolvedGifFile, gifOutputPath)
  }

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
    previewUrl: gifPublicUrl,
    previewWidth: targetDimensions.width,
    sourceUrl: gifPublicUrl,
  })

  await writePreviewOverrides(overridesPath, nextOverrides)
}

console.log(
  JSON.stringify(
    {
      dryRun: Boolean(args['dry-run']),
      slug,
      gifFile: resolvedGifFile,
      gifPublicUrl,
      posterPublicUrl,
      originalWidth: sourceWidth,
      originalHeight: sourceHeight,
      previewWidth: targetDimensions.width,
      previewHeight: targetDimensions.height,
      resized: shouldResizeGif,
      maxWidth,
      maxHeight,
      overridesPath,
    },
    null,
    2,
  ),
)
