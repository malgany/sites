import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const overridesPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'local-preview-overrides.json',
)
const postersDir = path.join(repoRoot, 'public', 'motionsites-posters')
const MAX_POSTER_WIDTH = 640
const POSTER_QUALITY = 64

const rawOverrides = JSON.parse(await fs.readFile(overridesPath, 'utf8'))

await fs.mkdir(postersDir, { recursive: true })

const nextOverrides = {}
const summary = []

for (const [slug, override] of Object.entries(rawOverrides)) {
  const animatedPreviewUrl =
    override.animatedPreviewUrl ?? override.previewUrl ?? null
  const animatedPreviewKind =
    override.animatedPreviewKind ?? override.previewKind ?? 'image'

  if (!animatedPreviewUrl || !animatedPreviewUrl.startsWith('/')) {
    nextOverrides[slug] = {
      ...override,
      animatedPreviewUrl,
      animatedPreviewKind,
      posterUrl: override.posterUrl ?? null,
      previewWidth: override.previewWidth ?? null,
      previewHeight: override.previewHeight ?? null,
    }
    continue
  }

  const absoluteAnimatedPath = path.join(
    repoRoot,
    'public',
    animatedPreviewUrl.slice(1),
  )
  const posterFileName = `${slug}.webp`
  const posterOutputPath = path.join(postersDir, posterFileName)
  const input = sharp(absoluteAnimatedPath, { animated: true, page: 0, pages: 1 })
  const metadata = await input.metadata()

  await input
    .resize({ width: MAX_POSTER_WIDTH, withoutEnlargement: true })
    .webp({ quality: POSTER_QUALITY, effort: 6 })
    .toFile(posterOutputPath)

  const posterStats = await fs.stat(posterOutputPath)

  nextOverrides[slug] = {
    previewKind: animatedPreviewKind,
    previewUrl: animatedPreviewUrl,
    animatedPreviewKind,
    animatedPreviewUrl,
    posterUrl: `/motionsites-posters/${posterFileName}`,
    previewWidth: metadata.width ?? override.previewWidth ?? null,
    previewHeight: metadata.height ?? override.previewHeight ?? null,
    sourceUrl: override.sourceUrl,
  }

  summary.push({
    slug,
    posterFileName,
    posterBytes: posterStats.size,
  })
}

await fs.writeFile(overridesPath, `${JSON.stringify(nextOverrides, null, 2)}\n`)

console.log(
  JSON.stringify(
    {
      generated: summary.length,
      maxPosterBytes: Math.max(...summary.map((entry) => entry.posterBytes), 0),
      averagePosterBytes:
        summary.reduce((total, entry) => total + entry.posterBytes, 0) /
          Math.max(summary.length, 1),
    },
    null,
    2,
  ),
)
