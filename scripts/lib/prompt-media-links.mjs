import { promises as fs } from 'node:fs'

export async function readPromptMediaLinks(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}

export async function writePromptMediaLinks(filePath, links) {
  await fs.writeFile(filePath, `${JSON.stringify(links, null, 2)}\n`)
}

export function upsertPromptMediaLink({
  cloudFrontUrl,
  fileBytes,
  fileName,
  links,
  s3Key,
  slug,
}) {
  return {
    ...links,
    [slug]: {
      mp4Url: cloudFrontUrl,
      s3Key,
      fileName,
      fileBytes,
      updatedAt: new Date().toISOString(),
    },
  }
}
