import { describe, expect, it, vi } from 'vitest'
import { getCatalogContent, listPublicCatalog } from './repository'
import { getBrowserSupabaseClient } from './client'

vi.mock('./client', () => ({
  getBrowserSupabaseClient: vi.fn(),
}))

const mockedGetBrowserSupabaseClient = vi.mocked(getBrowserSupabaseClient)

describe('catalog repository', () => {
  it('lists public cards ordered by sort order', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'b',
          title: 'B item',
          type_label: 'Automation',
          preview_url: null,
          preview_kind: null,
          is_public: true,
          sort_order: 20,
        },
        {
          slug: 'a',
          title: 'A item',
          type_label: 'Studio',
          preview_url: 'https://example.com/a.webp',
          preview_kind: 'image',
          is_public: true,
          sort_order: 10,
        },
      ],
      error: null,
    })

    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(listPublicCatalog()).resolves.toEqual([
      {
        slug: 'a',
        title: 'A item',
        typeLabel: 'Studio',
        previewUrl: 'https://example.com/a.webp',
        previewKind: 'image',
        isPublic: true,
      },
      {
        slug: 'b',
        title: 'B item',
        typeLabel: 'Automation',
        previewUrl: null,
        previewKind: 'image',
        isPublic: true,
      },
    ])

    expect(from).toHaveBeenCalledWith('catalog_prompts')
    expect(select).toHaveBeenCalledWith(
      'slug, title, type_label, preview_url, preview_kind, is_public, sort_order',
    )
    expect(eq).toHaveBeenCalledWith('is_public', true)
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('reads markdown content by slug from the public table', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { content_markdown: '# markdown' },
      error: null,
    })
    const secondEq = vi.fn(() => ({ single }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const select = vi.fn(() => ({ eq: firstEq }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(getCatalogContent('aethera-hero')).resolves.toBe('# markdown')

    expect(from).toHaveBeenCalledWith('catalog_prompts')
    expect(select).toHaveBeenCalledWith('content_markdown')
    expect(firstEq).toHaveBeenCalledWith('slug', 'aethera-hero')
    expect(secondEq).toHaveBeenCalledWith('is_public', true)
  })
})
