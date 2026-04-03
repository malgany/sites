const DEFAULT_TYPE_LABEL_MAP = new Map([
  ['3D Studio', 'Agency'],
  ['Agency', 'Agency'],
  ['AI', 'AI'],
  ['AI Agent', 'AI'],
  ['Animation', 'Component'],
  ['Automacao de IA', 'Automation'],
  ['Automação de IA', 'Automation'],
  ['Automation', 'Automation'],
  ['Biotech', 'Hero'],
  ['Booking', 'SaaS'],
  ['Brand', 'Hero'],
  ['Builder', 'AI'],
  ['Calculator', 'Component'],
  ['Education', 'Landing Page'],
  ['Hero', 'Hero'],
  ['Hero Section', 'Hero'],
  ['HR SaaS', 'SaaS'],
  ['Landing Page', 'Landing Page'],
  ['Logistics', 'Hero'],
  ['Luxury', 'Hero'],
  ['Marca', 'Hero'],
  ['Map', 'Component'],
  ['Payments', 'SaaS'],
  ['Portfolio', 'Portfolio'],
  ['Productivity', 'SaaS'],
  ['SaaS', 'SaaS'],
  ['Estudio', 'Agency'],
  ['Estúdio', 'Agency'],
  ['Studio', 'Agency'],
  ['Talent Platform', 'SaaS'],
  ['Ventures', 'Hero'],
  ['Video Agency', 'Agency'],
  ['Web3', 'Hero'],
])

const TYPE_LABEL_OVERRIDES_BY_SLUG = new Map([
  ['stellar-ai-hero', 'AI'],
  ['vortex-studio-hero', 'Portfolio'],
])

function trimString(value) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function getEntrySlug(entry) {
  return trimString(entry?.slug) ?? trimString(entry?.id)
}

function getEntryTypeLabel(entry) {
  return (
    trimString(entry?.typeLabel) ??
    trimString(entry?.type_label) ??
    trimString(entry?.category)
  )
}

function getEntryKeywords(entry) {
  const explicitKeywords =
    entry?.referenceLookup?.keywords ?? entry?.reference_lookup?.keywords ?? entry?.keywords

  if (!Array.isArray(explicitKeywords)) {
    return []
  }

  return explicitKeywords
    .map((keyword) => trimString(keyword))
    .filter(Boolean)
}

function dedupeKeywords(keywords) {
  return Array.from(new Set(keywords))
}

export function normalizeCatalogTypeLabel(entry) {
  const slug = getEntrySlug(entry)
  const currentTypeLabel = getEntryTypeLabel(entry)

  if (!currentTypeLabel) {
    return null
  }

  if (slug && TYPE_LABEL_OVERRIDES_BY_SLUG.has(slug)) {
    return TYPE_LABEL_OVERRIDES_BY_SLUG.get(slug)
  }

  return DEFAULT_TYPE_LABEL_MAP.get(currentTypeLabel) ?? currentTypeLabel
}

export function buildCatalogTaxonomy(entry) {
  const currentTypeLabel = getEntryTypeLabel(entry)
  const normalizedTypeLabel = normalizeCatalogTypeLabel(entry)
  const existingKeywords = getEntryKeywords(entry)

  if (!currentTypeLabel || !normalizedTypeLabel) {
    return {
      keywords: existingKeywords,
      typeLabel: currentTypeLabel,
    }
  }

  const keywords = dedupeKeywords([
    ...existingKeywords,
    ...(normalizedTypeLabel === currentTypeLabel ? [] : [currentTypeLabel]),
  ])

  return {
    keywords,
    typeLabel: normalizedTypeLabel,
  }
}
