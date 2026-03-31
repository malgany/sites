import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm3u8', 'webm'])
const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'])

export function normalizeLookupValue(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export async function resolveLatestSourceFile(sourceDir, slug) {
  const prefix = `${slug}-`
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  const matchingEntries = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.startsWith(prefix) &&
      entry.name.toLowerCase().endsWith('.md'),
  )

  if (!matchingEntries.length) {
    return null
  }

  const detailedEntries = await Promise.all(
    matchingEntries.map(async (entry) => {
      const absolutePath = path.join(sourceDir, entry.name)
      const stats = await fs.stat(absolutePath)

      return {
        absolutePath,
        modifiedAtMs: stats.mtimeMs,
        name: entry.name,
      }
    }),
  )

  detailedEntries.sort((left, right) => {
    if (left.modifiedAtMs !== right.modifiedAtMs) {
      return right.modifiedAtMs - left.modifiedAtMs
    }

    return right.name.localeCompare(left.name)
  })

  return detailedEntries[0] ?? null
}

export function extractMediaUrls(markdown) {
  const matches =
    String(markdown ?? '').match(/https?:\/\/[^\s<>"')]+/gi) ?? []
  const dedupedUrls = []
  const seen = new Set()

  for (const match of matches) {
    const normalizedUrl = match.replace(/[),.;]+$/g, '')

    if (!isMediaUrl(normalizedUrl) || seen.has(normalizedUrl)) {
      continue
    }

    seen.add(normalizedUrl)
    dedupedUrls.push(normalizedUrl)
  }

  return dedupedUrls
}

export function inferPreviewKindFromUrl(url) {
  const extension = getUrlExtension(url)
  return VIDEO_EXTENSIONS.has(extension) ? 'video' : 'image'
}

export function getUrlExtension(url) {
  try {
    const parsedUrl = new URL(url)
    const extension = path.extname(parsedUrl.pathname).replace('.', '')
    return extension.toLowerCase()
  } catch {
    return ''
  }
}

export function getAssetExtension(url, contentType = null) {
  const urlExtension = getUrlExtension(url)

  if (VIDEO_EXTENSIONS.has(urlExtension) || IMAGE_EXTENSIONS.has(urlExtension)) {
    return urlExtension
  }

  if (!contentType) {
    return inferPreviewKindFromUrl(url) === 'video' ? 'mp4' : 'jpg'
  }

  if (contentType.includes('mp4')) {
    return 'mp4'
  }

  if (contentType.includes('mpegurl')) {
    return 'm3u8'
  }

  if (contentType.includes('webm')) {
    return 'webm'
  }

  if (contentType.includes('gif')) {
    return 'gif'
  }

  if (contentType.includes('webp')) {
    return 'webp'
  }

  if (contentType.includes('png')) {
    return 'png'
  }

  if (contentType.includes('avif')) {
    return 'avif'
  }

  return 'jpg'
}

export function createSourceHash(content) {
  return crypto.createHash('sha256').update(String(content ?? '')).digest('hex')
}

export function slugToStorageBasename(slug) {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isMediaUrl(url) {
  const extension = getUrlExtension(url)

  if (VIDEO_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension)) {
    return true
  }

  return url.includes('.m3u8') || url.includes('/video/') || url.includes('/image/')
}
