import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createSourceHash,
  extractMediaUrls,
  inferPreviewKindFromUrl,
  resolveLatestSourceFile,
} from '../scripts/lib/catalog-sync-utils.mjs'

const tempDirectories = []

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      fs.rm(directory, { force: true, recursive: true }),
    ),
  )
})

describe('catalog sync utils', () => {
  it('resolves the most recent markdown file for a slug, including numeric ids', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-sync-'))
    tempDirectories.push(tempDir)

    const olderFile = path.join(tempDir, '10-2026-03-30T20-00-00-000Z.md')
    const newerFile = path.join(tempDir, '10-2026-03-30T21-00-00-000Z.md')
    const anotherSlug = path.join(tempDir, '1-2026-03-30T22-00-00-000Z.md')

    await fs.writeFile(olderFile, 'older')
    await fs.writeFile(newerFile, 'newer')
    await fs.writeFile(anotherSlug, 'other slug')

    await fs.utimes(olderFile, new Date('2026-03-30T20:00:00.000Z'), new Date('2026-03-30T20:00:00.000Z'))
    await fs.utimes(newerFile, new Date('2026-03-30T21:00:00.000Z'), new Date('2026-03-30T21:00:00.000Z'))
    await fs.utimes(anotherSlug, new Date('2026-03-30T22:00:00.000Z'), new Date('2026-03-30T22:00:00.000Z'))

    await expect(resolveLatestSourceFile(tempDir, '10')).resolves.toMatchObject({
      name: '10-2026-03-30T21-00-00-000Z.md',
    })
    await expect(resolveLatestSourceFile(tempDir, '1')).resolves.toMatchObject({
      name: '1-2026-03-30T22-00-00-000Z.md',
    })
  })

  it('extracts unique media urls from markdown content', () => {
    const markdown = `
      Preview 1 https://cdn.example.com/preview.mp4
      Preview 2 https://cdn.example.com/frame.jpg
      Again https://cdn.example.com/preview.mp4
      Ignore https://example.com/docs
    `

    expect(extractMediaUrls(markdown)).toEqual([
      'https://cdn.example.com/preview.mp4',
      'https://cdn.example.com/frame.jpg',
    ])
  })

  it('infers preview kind from the media url and produces stable hashes', () => {
    expect(inferPreviewKindFromUrl('https://cdn.example.com/video.m3u8')).toBe('video')
    expect(inferPreviewKindFromUrl('https://cdn.example.com/frame.webp')).toBe('image')
    expect(createSourceHash('hello')).toBe(createSourceHash('hello'))
  })
})
