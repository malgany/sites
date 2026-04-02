import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCatalogAdminClient,
  getMotionSitesLookupSlug,
  loadCatalogInventory,
  loadEnvFiles,
} from './lib/catalog-supabase.mjs'
import {
  createMotionSitesPublicClient,
  DEFAULT_MOTIONSITES_SITE_URL,
  fetchMotionSitesPromptMap,
  fetchMotionSitesSiteCatalog,
} from './lib/motionsites-site-catalog.mjs'
import { normalizeCatalogTypeLabel } from './lib/catalog-taxonomy.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const motionSitesSiteUrl =
  process.env.MOTIONSITES_SITE_URL?.trim() || DEFAULT_MOTIONSITES_SITE_URL
const supabase = createCatalogAdminClient()
const catalogInventory = await loadCatalogInventory({ supabase })

if (!catalogInventory.length) {
  throw new Error(
    'Catalog inventory is empty in Supabase. Create rows in public.catalog_prompts before comparing against MotionSites.',
  )
}

const snapshot = await fetchMotionSitesSiteCatalog({
  siteUrl: motionSitesSiteUrl,
})
const motionSitesClient = createMotionSitesPublicClient(snapshot)
const promptMap = await fetchMotionSitesPromptMap({
  client: motionSitesClient,
  promptIds: snapshot.items.map((item) => item.id),
})

const siteById = new Map(snapshot.items.map((item) => [item.id, item]))
const inventorySiteIds = new Set(catalogInventory.map(getMotionSitesLookupSlug))
const promptAvailabilitySummary = summarizePromptAvailability(promptMap)

const siteOnly = snapshot.items
  .filter((item) => !inventorySiteIds.has(item.id))
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

const inventoryOnly = catalogInventory
  .filter((item) => !siteById.has(getMotionSitesLookupSlug(item)))
  .map((item) => ({
    slug: item.slug,
    title: item.title,
  }))

const metadataDifferences = []
const syncReady = []
const unavailableInCatalog = []

for (const item of catalogInventory) {
  const lookupSlug = getMotionSitesLookupSlug(item)
  const siteEntry = siteById.get(lookupSlug)

  if (!siteEntry) {
    unavailableInCatalog.push({
      availability: 'missing_on_site',
      slug: item.slug,
      title: item.title,
    })
    continue
  }

  const normalizedSiteTypeLabel = normalizeCatalogTypeLabel(siteEntry)

  if (
    siteEntry.title !== item.title ||
    normalizedSiteTypeLabel !== item.typeLabel
  ) {
    metadataDifferences.push({
      localTitle: item.title,
      localTypeLabel: item.typeLabel,
      normalizedSiteTypeLabel,
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

  unavailableInCatalog.push({
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
      catalogCount: catalogInventory.length,
      catalogOnly: inventoryOnly,
      catalogOnlyCount: inventoryOnly.length,
      inaccessibleSiteOnly,
      inaccessibleSiteOnlyCount: inaccessibleSiteOnly.length,
      metadataDifferences,
      metadataDifferencesCount: metadataDifferences.length,
      motionSitesSiteUrl: snapshot.siteUrl,
      promptAvailabilitySummary,
      siteCount: snapshot.items.length,
      siteOnly,
      siteOnlyCount: siteOnly.length,
      syncReady,
      syncReadyCount: syncReady.length,
      unavailableInCatalog,
      unavailableInCatalogCount: unavailableInCatalog.length,
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
