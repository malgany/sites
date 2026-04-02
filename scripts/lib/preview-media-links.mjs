import { promises as fs } from 'node:fs'

export async function readPreviewMediaLinks(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

export async function writePreviewMediaLinks(filePath, links) {
  await fs.writeFile(filePath, `${JSON.stringify(links, null, 2)}\n`)
}

export function upsertPreviewMediaLink({
  cloudFrontUrl,
  fileBytes,
  fileName,
  links,
  originalHeight,
  originalWidth,
  previewHeight,
  previewWidth,
  s3Key,
  slug,
}) {
  return {
    ...links,
    [slug]: {
      gifUrl: cloudFrontUrl,
      s3Key,
      fileName,
      fileBytes,
      originalWidth,
      originalHeight,
      previewWidth,
      previewHeight,
      updatedAt: new Date().toISOString(),
    },
  }
}
