import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

const usage = `
Usage:
  npm run set:preview-override -- \\
    --slug atelie-orbita \\
    --preview-url /card-gifs/atelie-orbita.gif \\
    --poster-url /card-posters/atelie-orbita.webp \\
    --preview-kind image \\
    --width 1280 \\
    --height 720

Required:
  --slug
  --preview-url

Optional:
  --poster-url
  --preview-kind
  --width
  --height
  --source-url
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

function normalizeNumber(value) {
  if (value === undefined) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(usage)
  process.exit(0)
}

const slug = normalizeString(args.slug)
const previewUrl = normalizeString(args['preview-url'])
const previewKind =
  normalizeString(args['preview-kind']) === 'video' ? 'video' : 'image'

if (!slug || !previewUrl) {
  throw new Error(`${usage}\n\n--slug and --preview-url are required.`)
}

const rawOverrides = await readPreviewOverrides(overridesPath)
const nextOverrides = upsertPreviewOverride({
  overrides: rawOverrides,
  slug,
  posterUrl: normalizeString(args['poster-url']),
  previewHeight: normalizeNumber(args.height),
  previewKind,
  previewUrl,
  previewWidth: normalizeNumber(args.width),
  sourceUrl: normalizeString(args['source-url']),
})
const nextOverride = nextOverrides[slug]

if (args['dry-run']) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        slug,
        override: nextOverride,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

await writePreviewOverrides(overridesPath, nextOverrides)

console.log(
  JSON.stringify(
    {
      saved: true,
      slug,
      override: nextOverride,
      overridesPath,
    },
    null,
    2,
  ),
)
