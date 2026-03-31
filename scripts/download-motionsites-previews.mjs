import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from '../src/catalog/catalog-manifest.json' with { type: 'json' }
import { resolveLatestSourceFile } from './lib/catalog-sync-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const sourceDir = process.env.CATALOG_SOURCE_DIR?.trim() || 'E:\\Projects\\hackzin\\output'
const outputDir = path.join(repoRoot, 'public', 'motionsites-previews')
const overridesPath = path.join(
  repoRoot,
  'src',
  'catalog',
  'local-preview-overrides.json',
)

await fs.mkdir(outputDir, { recursive: true })

const activeManifestItems = []

for (const item of manifest) {
  const sourceFile = await resolveLatestSourceFile(sourceDir, item.slug)

  if (!sourceFile) {
    continue
  }

  activeManifestItems.push(item)
}

const html = await fetchText('https://motionsites.ai/')
const bundlePathMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/)

if (!bundlePathMatch) {
  throw new Error('Could not find the MotionSites client bundle path.')
}

const bundleUrl = new URL(bundlePathMatch[1], 'https://motionsites.ai').toString()
const bundle = await fetchText(bundleUrl)
const assetPaths = buildAssetPathMap(bundle)
const cardMap = buildCardAssetMap(bundle, assetPaths)

const localPreviewOverrides = {}
const summary = {
  downloaded: 0,
  missingCardAsset: [],
  missingDownloadedAsset: [],
}

for (const item of activeManifestItems) {
  const cardAsset = cardMap.get(item.slug)

  if (!cardAsset) {
    summary.missingCardAsset.push(item.slug)
    continue
  }

  const response = await fetch(cardAsset.sourceUrl)

  if (!response.ok) {
    summary.missingDownloadedAsset.push(item.slug)
    continue
  }

  const arrayBuffer = await response.arrayBuffer()
  const extension = path.extname(new URL(cardAsset.sourceUrl).pathname) || '.gif'
  const localFileName = `${item.slug}${extension}`
  const absolutePath = path.join(outputDir, localFileName)
  await fs.writeFile(absolutePath, Buffer.from(arrayBuffer))

  localPreviewOverrides[item.slug] = {
    previewKind: 'image',
    previewUrl: `/motionsites-previews/${localFileName}`,
    sourceUrl: cardAsset.sourceUrl,
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
      bundleUrl,
      downloaded: summary.downloaded,
      missingCardAsset: summary.missingCardAsset,
      missingDownloadedAsset: summary.missingDownloadedAsset,
    },
    null,
    2,
  ),
)

function buildAssetPathMap(bundle) {
  const assetMap = new Map()
  const assetRegex = /([A-Za-z$_][A-Za-z0-9$_]*)="(\/assets\/[^"]+\.(?:gif|png|jpe?g|webp|avif))"/g

  for (const match of bundle.matchAll(assetRegex)) {
    const [, variableName, assetPath] = match
    assetMap.set(variableName, assetPath)
  }

  return assetMap
}

function buildCardAssetMap(bundle, assetPaths) {
  const cardMap = new Map()
  const cardRegex = /\{id:"([^"]+)",title:"([^"]+)",image:([A-Za-z$_][A-Za-z0-9$_]*)/g

  for (const match of bundle.matchAll(cardRegex)) {
    const [, id, title, assetVariable] = match
    const assetPath = assetPaths.get(assetVariable)

    if (!assetPath) {
      continue
    }

    cardMap.set(id, {
      sourceUrl: new URL(assetPath, 'https://motionsites.ai').toString(),
      title,
    })
  }

  return cardMap
}

async function fetchText(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}
