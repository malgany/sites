import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createCatalogAdminClient,
  getMissingCatalogColumnName,
  loadEnvFiles,
} from './lib/catalog-supabase.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

await loadEnvFiles([
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
])

const usage = `
Usage:
  npm run set:catalog-active -- --slug atelie-orbita --inactive
  npm run set:catalog-active -- --slugs atelie-orbita,asme-vidro-liquido --active

Required:
  --slug or --slugs

One of:
  --active
  --inactive

Optional:
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

    if (key === 'help' || key === 'active' || key === 'inactive') {
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

function normalizeSlugList(args) {
  const rawSlugs = [
    normalizeString(args.slug),
    ...String(args.slugs ?? '')
      .split(',')
      .map((entry) => normalizeString(entry))
      .filter(Boolean),
  ].filter(Boolean)

  return Array.from(new Set(rawSlugs))
}

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(usage)
  process.exit(0)
}

const slugs = normalizeSlugList(args)
const wantsActive = Boolean(args.active)
const wantsInactive = Boolean(args.inactive)

if (!slugs.length || wantsActive === wantsInactive) {
  throw new Error(`${usage}\n\nProvide at least one slug and exactly one of --active or --inactive.`)
}

const supabase = createCatalogAdminClient()
const isActive = wantsActive
const payload = {
  is_active: isActive,
}

const { error } = await supabase
  .from('catalog_prompts')
  .update(payload)
  .in('slug', slugs)

if (error) {
  const missingColumn = getMissingCatalogColumnName(error)

  if (missingColumn === 'is_active') {
    throw new Error(
      'The remote catalog schema does not have "is_active" yet. Apply supabase/bootstrap/catalog_public_catalog.sql first.',
    )
  }

  throw new Error(`Could not update active state: ${error.message}`)
}

const { data, error: verifyError } = await supabase
  .from('catalog_prompts')
  .select('slug, is_active')
  .in('slug', slugs)

if (verifyError) {
  throw new Error(`Could not verify active state: ${verifyError.message}`)
}

console.log(
  JSON.stringify(
    {
      isActive,
      slugs,
      updatedRows: data ?? [],
    },
    null,
    2,
  ),
)
