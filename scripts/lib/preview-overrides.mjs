import { promises as fs } from 'node:fs'

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeNumber(value) {
  if (value === undefined || value === null) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizePreviewKind(value) {
  return normalizeString(value) === 'video' ? 'video' : 'image'
}

export async function readPreviewOverrides(overridesPath) {
  return JSON.parse(await fs.readFile(overridesPath, 'utf8'))
}

export async function writePreviewOverrides(overridesPath, overrides) {
  await fs.writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`)
}

export function buildPreviewOverride({
  existingOverride = null,
  posterUrl,
  previewHeight,
  previewKind,
  previewUrl,
  previewWidth,
  sourceUrl,
}) {
  const normalizedPreviewUrl =
    normalizeString(previewUrl) ??
    normalizeString(existingOverride?.animatedPreviewUrl) ??
    normalizeString(existingOverride?.previewUrl)

  if (!normalizedPreviewUrl) {
    throw new Error('Missing previewUrl for preview override.')
  }

  const normalizedPreviewKind =
    normalizePreviewKind(previewKind) ??
    normalizePreviewKind(existingOverride?.animatedPreviewKind) ??
    normalizePreviewKind(existingOverride?.previewKind)

  return {
    previewKind: normalizedPreviewKind,
    previewUrl: normalizedPreviewUrl,
    animatedPreviewKind: normalizedPreviewKind,
    animatedPreviewUrl: normalizedPreviewUrl,
    posterUrl:
      normalizeString(posterUrl) ??
      normalizeString(existingOverride?.posterUrl) ??
      null,
    previewWidth:
      normalizeNumber(previewWidth) ??
      normalizeNumber(existingOverride?.previewWidth) ??
      null,
    previewHeight:
      normalizeNumber(previewHeight) ??
      normalizeNumber(existingOverride?.previewHeight) ??
      null,
    sourceUrl:
      normalizeString(sourceUrl) ??
      normalizeString(existingOverride?.sourceUrl) ??
      normalizedPreviewUrl,
  }
}

export function upsertPreviewOverride({
  overrides,
  slug,
  posterUrl,
  previewHeight,
  previewKind,
  previewUrl,
  previewWidth,
  sourceUrl,
}) {
  const existingOverride =
    typeof overrides[slug] === 'object' && overrides[slug] !== null
      ? overrides[slug]
      : null

  return {
    ...overrides,
    [slug]: buildPreviewOverride({
      existingOverride,
      posterUrl,
      previewHeight,
      previewKind,
      previewUrl,
      previewWidth,
      sourceUrl,
    }),
  }
}
