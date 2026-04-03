import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildCatalogTaxonomy } from './lib/catalog-taxonomy.mjs'
import {
  createCatalogAdminClient,
  loadCatalogInventory,
  loadEnvFiles,
  normalizeCatalogReferenceLookup,
} from './lib/catalog-supabase.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const manifestPath = path.join(repoRoot, 'src', 'catalog', 'catalog-manifest.json')

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const rawManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const localChanged = []
const nextManifest = rawManifest.map((item) => {
  const nextTaxonomy = buildCatalogTaxonomy(item)
  const currentReferenceLookup = normalizeCatalogReferenceLookup(
    item.referenceLookup,
    item.title,
  )
  const nextReferenceLookup = normalizeCatalogReferenceLookup(
    {
      ...item.referenceLookup,
      keywords: nextTaxonomy.keywords,
    },
    item.title,
  )
  const didTypeChange = nextTaxonomy.typeLabel !== item.typeLabel
  const didKeywordsChange =
    JSON.stringify(currentReferenceLookup) !== JSON.stringify(nextReferenceLookup)

  if (!didTypeChange && !didKeywordsChange) {
    return item
  }

  localChanged.push({
    fromTypeLabel: item.typeLabel,
    keywords: nextReferenceLookup.keywords ?? [],
    slug: item.slug,
    title: item.title,
    toTypeLabel: nextTaxonomy.typeLabel,
  })

  return {
    ...item,
    referenceLookup:
      Object.keys(nextReferenceLookup).length > 0 ? nextReferenceLookup : undefined,
    typeLabel: nextTaxonomy.typeLabel,
  }
})

if (localChanged.length) {
  await fs.writeFile(`${manifestPath}`, `${JSON.stringify(nextManifest, null, 2)}\n`)
}

const supabase = createCatalogAdminClient()
const catalogInventory = await loadCatalogInventory({ supabase })

if (!catalogInventory.length) {
  throw new Error(
    'Catalog inventory is empty in Supabase. Create rows in public.catalog_prompts before normalizing the taxonomy.',
  )
}

const summary = {
  changed: [],
  skippedKeywordPersistenceCount: 0,
  unchangedCount: 0,
}

for (const item of catalogInventory) {
  const nextTaxonomy = buildCatalogTaxonomy(item)
  const nextReferenceLookup = normalizeCatalogReferenceLookup(
    {
      ...item.referenceLookup,
      keywords: nextTaxonomy.keywords,
    },
    item.title,
  )
  const currentKeywords = item.referenceLookup?.keywords ?? []
  const nextKeywords = nextReferenceLookup.keywords ?? []
  const didTypeChange = nextTaxonomy.typeLabel !== item.typeLabel
  const didKeywordsChange =
    JSON.stringify(currentKeywords) !== JSON.stringify(nextKeywords)

  if (!didTypeChange && !didKeywordsChange) {
    summary.unchangedCount += 1
    continue
  }

  const updatePayload = {
    type_label: nextTaxonomy.typeLabel,
    reference_lookup: nextReferenceLookup,
  }
  let { error } = await supabase
    .from('catalog_prompts')
    .update(updatePayload)
    .eq('slug', item.slug)

  if (
    error?.message?.includes("Could not find the 'reference_lookup' column")
  ) {
    summary.skippedKeywordPersistenceCount += 1
    ;({ error } = await supabase
      .from('catalog_prompts')
      .update({
        type_label: nextTaxonomy.typeLabel,
      })
      .eq('slug', item.slug))
  }

  if (error) {
    throw new Error(`Could not normalize taxonomy for "${item.slug}": ${error.message}`)
  }

  summary.changed.push({
    fromTypeLabel: item.typeLabel,
    keywords: nextKeywords,
    slug: item.slug,
    title: item.title,
    toTypeLabel: nextTaxonomy.typeLabel,
  })
}

console.log(
  JSON.stringify(
    {
      changed: summary.changed,
      changedCount: summary.changed.length,
      localChanged,
      localChangedCount: localChanged.length,
      skippedKeywordPersistenceCount: summary.skippedKeywordPersistenceCount,
      unchangedCount: summary.unchangedCount,
    },
    null,
    2,
  ),
)
