import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from '../src/catalog/catalog-manifest.json' with { type: 'json' }
import {
  createMotionSitesPublicClient,
  DEFAULT_MOTIONSITES_SITE_URL,
  fetchMotionSitesPromptMap,
  fetchMotionSitesSiteCatalog,
} from './lib/motionsites-site-catalog.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const outputDir = path.join(repoRoot, 'public', 'motionsites-previews')
const overridesPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'local-preview-overrides.json',
)
const motionSitesSiteUrl =
  process.env.MOTIONSITES_SITE_URL?.trim() || DEFAULT_MOTIONSITES_SITE_URL

await fs.mkdir(outputDir, { recursive: true })

let existingPreviewOverrides = {}

try {
  existingPreviewOverrides = JSON.parse(await fs.readFile(overridesPath, 'utf8'))
} catch (error) {
  if (error?.code !== 'ENOENT') {
    throw error
  }
}

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
const cardMap = new Map(snapshot.items.map((card) => [card.id, card]))

const localPreviewOverrides = {}
const summary = {
  downloaded: 0,
  missingCardAsset: [],
  missingDownloadedAsset: [],
  skippedUnavailablePrompt: [],
}

for (const item of manifest) {
  const lookupSlug = item.referenceLookup?.motionSitesSlug?.trim() || item.slug
  const promptDetails = promptMap.get(lookupSlug)

  if (!promptDetails?.promptText) {
    summary.skippedUnavailablePrompt.push(item.slug)
    continue
  }

  const cardAsset = cardMap.get(lookupSlug)

  if (!cardAsset) {
    summary.missingCardAsset.push(item.slug)
    continue
  }

  const response = await fetch(cardAsset.previewUrl)

  if (!response.ok) {
    summary.missingDownloadedAsset.push(item.slug)
    continue
  }

  const arrayBuffer = await response.arrayBuffer()
  const extension = path.extname(new URL(cardAsset.previewUrl).pathname) || '.gif'
  const localFileName = `${item.slug}${extension}`
  const absolutePath = path.join(outputDir, localFileName)
  await fs.writeFile(absolutePath, Buffer.from(arrayBuffer))

  const existingOverride = existingPreviewOverrides[item.slug] ?? {}

  localPreviewOverrides[item.slug] = {
    previewKind: 'image',
    previewUrl: `/motionsites-previews/${localFileName}`,
    animatedPreviewKind: 'image',
    animatedPreviewUrl: `/motionsites-previews/${localFileName}`,
    posterUrl: existingOverride.posterUrl ?? cardAsset.posterUrl ?? null,
    previewWidth: existingOverride.previewWidth ?? null,
    previewHeight: existingOverride.previewHeight ?? null,
    sourceUrl: cardAsset.previewUrl,
  }

  summary.downloaded += 1
}

await fs.writeFile(
  overridesPath,
  `${JSON.stringify(localPreviewOverrides, null, 2)}\n`,
)

console.log(
  JSON.stringify(
    {
      bundleUrl: snapshot.bundleUrl,
      downloaded: summary.downloaded,
      missingCardAsset: summary.missingCardAsset,
      missingDownloadedAsset: summary.missingDownloadedAsset,
      motionSitesSiteUrl: snapshot.siteUrl,
      siteItemCount: snapshot.items.length,
      skippedUnavailablePrompt: summary.skippedUnavailablePrompt,
      skippedUnavailablePromptCount: summary.skippedUnavailablePrompt.length,
    },
    null,
    2,
  ),
)
