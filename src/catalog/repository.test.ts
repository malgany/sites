import { describe, expect, it, vi } from 'vitest'
import {
  getCatalogContent,
  getStaticCatalog,
  refreshCatalogMetadata,
} from './repository'
import { getBrowserSupabaseClient } from './client'

vi.mock('./client', () => ({
  getBrowserSupabaseClient: vi.fn(),
}))

const mockedGetBrowserSupabaseClient = vi.mocked(getBrowserSupabaseClient)

describe('catalog repository', () => {
  it('builds the initial card list from the local manifest and local posters', () => {
    const items = getStaticCatalog()
    const aetheraCard = items.find((item) => item.slug === 'aethera-hero')

    expect(items.length).toBeGreaterThan(0)
    expect(aetheraCard).toMatchObject({
      slug: 'aethera-hero',
      title: 'Aethera Studio',
      posterUrl: expect.stringMatching(/^\/motionsites-posters\//),
      animatedPreviewUrl: '/motionsites-previews/aethera-hero.gif',
      animatedPreviewKind: 'image',
      isPublic: true,
    })
  })

  it('merges remote preview metadata without blocking the local catalog', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'ai-designer-agency',
          title: 'AI Designer Agency',
          type_label: 'Agency',
          preview_url: 'https://example.com/ai-designer-agency.webp',
          preview_kind: 'image',
          is_public: true,
          sort_order: 3,
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

    const items = await refreshCatalogMetadata()
    const mergedCard = items.find((item) => item.slug === 'ai-designer-agency')

    expect(mergedCard).toMatchObject({
      slug: 'ai-designer-agency',
      title: 'AI Designer Agency',
      typeLabel: 'Agency',
      posterUrl: 'https://example.com/ai-designer-agency.webp',
      animatedPreviewUrl: null,
      animatedPreviewKind: null,
      isPublic: true,
    })

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
