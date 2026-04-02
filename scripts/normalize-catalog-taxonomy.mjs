import path from 'node:path'
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

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

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
      skippedKeywordPersistenceCount: summary.skippedKeywordPersistenceCount,
      unchangedCount: summary.unchangedCount,
    },
    null,
    2,
  ),
)
