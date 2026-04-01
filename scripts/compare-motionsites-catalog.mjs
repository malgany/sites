import { existsSync } from 'node:fs'
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

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const motionSitesSiteUrl =
  process.env.MOTIONSITES_SITE_URL?.trim() || DEFAULT_MOTIONSITES_SITE_URL
const snapshot = await fetchMotionSitesSiteCatalog({
  siteUrl: motionSitesSiteUrl,
})
const motionSitesClient = createMotionSitesPublicClient(snapshot)
const promptMap = await fetchMotionSitesPromptMap({
  client: motionSitesClient,
  promptIds: snapshot.items.map((item) => item.id),
})

const siteById = new Map(snapshot.items.map((item) => [item.id, item]))
const manifestSlugs = new Set(manifest.map((item) => item.slug))
const promptAvailabilitySummary = summarizePromptAvailability(promptMap)

const siteOnly = snapshot.items
  .filter((item) => !manifestSlugs.has(item.id))
  .map((item) => ({
    availability: getPromptAvailabilityLabel(promptMap.get(item.id)),
    category: item.category,
    id: item.id,
    title: item.title,
    type: item.type,
  }))

const availableSiteOnly = siteOnly.filter((item) => item.availability === 'available')
const inaccessibleSiteOnly = siteOnly.filter(
  (item) => item.availability !== 'available',
)

const manifestOnly = manifest
  .filter((item) => !siteById.has(item.referenceLookup?.motionSitesSlug ?? item.slug))
  .map((item) => ({
    slug: item.slug,
    title: item.title,
  }))

const metadataDifferences = []
const syncReady = []
const unavailableInManifest = []

for (const item of manifest) {
  const lookupSlug = item.referenceLookup?.motionSitesSlug?.trim() || item.slug
  const siteEntry = siteById.get(lookupSlug)

  if (!siteEntry) {
    unavailableInManifest.push({
      availability: 'missing_on_site',
      slug: item.slug,
      title: item.title,
    })
    continue
  }

  if (siteEntry.title !== item.title || siteEntry.category !== item.typeLabel) {
    metadataDifferences.push({
      localTitle: item.title,
      localTypeLabel: item.typeLabel,
      siteCategory: siteEntry.category,
      siteTitle: siteEntry.title,
      slug: item.slug,
    })
  }

  const promptDetails = promptMap.get(siteEntry.id)

  if (promptDetails?.promptText) {
    syncReady.push({
      promptLength: promptDetails.promptText.length,
      siteId: siteEntry.id,
      slug: item.slug,
      title: item.title,
    })
    continue
  }

  unavailableInManifest.push({
    availability: getPromptAvailabilityLabel(promptDetails),
    siteId: siteEntry.id,
    slug: item.slug,
    title: item.title,
  })
}

console.log(
  JSON.stringify(
    {
      availablePromptCount: promptAvailabilitySummary.available ?? 0,
      availableSiteOnly,
      availableSiteOnlyCount: availableSiteOnly.length,
      bundleUrl: snapshot.bundleUrl,
      inaccessibleSiteOnly,
      inaccessibleSiteOnlyCount: inaccessibleSiteOnly.length,
      manifestCount: manifest.length,
      manifestOnly,
      manifestOnlyCount: manifestOnly.length,
      metadataDifferences,
      metadataDifferencesCount: metadataDifferences.length,
      motionSitesSiteUrl: snapshot.siteUrl,
      promptAvailabilitySummary,
      siteCount: snapshot.items.length,
      siteOnly,
      siteOnlyCount: siteOnly.length,
      syncReady,
      syncReadyCount: syncReady.length,
      unavailableInManifest,
      unavailableInManifestCount: unavailableInManifest.length,
      unavailablePromptCount:
        snapshot.items.length - (promptAvailabilitySummary.available ?? 0),
    },
    null,
    2,
  ),
)

function getPromptAvailabilityLabel(promptDetails) {
  if (promptDetails?.promptText) {
    return 'available'
  }

  return promptDetails?.code ?? promptDetails?.error ?? 'unknown'
}

function summarizePromptAvailability(promptMap) {
  const summary = {}

  for (const promptDetails of promptMap.values()) {
    const key = getPromptAvailabilityLabel(promptDetails)
    summary[key] = (summary[key] ?? 0) + 1
  }

  return summary
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
