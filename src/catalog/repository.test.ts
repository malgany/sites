import { describe, expect, it, vi } from 'vitest'
import { getCatalogContent, refreshCatalogMetadata } from './repository'
import { getBrowserSupabaseClient } from './client'

vi.mock('./client', () => ({
  getBrowserSupabaseClient: vi.fn(),
}))

const mockedGetBrowserSupabaseClient = vi.mocked(getBrowserSupabaseClient)

describe('catalog repository', () => {
  it('maps the remote catalog rows into card metadata', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'ai-designer-agency',
          title: 'AI Designer Agency',
          type_label: 'Agency',
          reference_lookup: {
            keywords: ['AI', 'Design'],
          },
          poster_url: '/motionsites-posters/ai-designer-agency.webp',
          preview_url: 'https://example.com/ai-designer-agency.gif',
          preview_kind: 'image',
          preview_width: 455,
          preview_height: 800,
          is_active: true,
          is_public: true,
          sort_order: 3,
        },
      ],
      error: null,
    })

    const secondEq = vi.fn(() => ({ order }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const select = vi.fn(() => ({ eq: firstEq }))
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
      keywords: ['AI', 'Design'],
      posterUrl: '/motionsites-posters/ai-designer-agency.webp',
      animatedPreviewUrl: 'https://example.com/ai-designer-agency.gif',
      animatedPreviewKind: 'image',
      previewWidth: 455,
      previewHeight: 800,
      isPublic: true,
    })

    expect(from).toHaveBeenCalledWith('catalog_prompts')
    expect(select).toHaveBeenCalledWith(
      'slug, title, type_label, reference_lookup, poster_url, preview_url, preview_kind, preview_width, preview_height, is_active, is_public, sort_order',
    )
    expect(firstEq).toHaveBeenCalledWith('is_public', true)
    expect(secondEq).toHaveBeenCalledWith('is_active', true)
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('prefers the mirrored local media assets over remote preview urls when they exist', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'atelie-orbita',
          title: 'Atelie Orbita',
          type_label: 'Estudio',
          reference_lookup: {
            keywords: ['Estudio'],
          },
          poster_url: 'https://example.com/remote-atelie-orbita.webp',
          preview_url: 'https://example.com/remote-atelie-orbita.gif',
          preview_kind: 'image',
          preview_width: 1200,
          preview_height: 1600,
          is_active: true,
          is_public: true,
          sort_order: 1,
        },
      ],
      error: null,
    })

    const secondEq = vi.fn(() => ({ order }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const select = vi.fn(() => ({ eq: firstEq }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(refreshCatalogMetadata()).resolves.toEqual([
      {
        slug: 'atelie-orbita',
        title: 'Atelie Orbita',
        typeLabel: 'Estudio',
        keywords: ['Estudio'],
        posterUrl: '/card-posters/atelie-orbita.webp',
        animatedPreviewUrl:
          'https://d39qrw7a9vnyeo.cloudfront.net/cards/atelie-orbita/preview-gif-20260402-201043-7a6984.gif',
        animatedPreviewKind: 'image',
        previewWidth: 480,
        previewHeight: 339,
        isPublic: true,
      },
    ])
  })

  it('uses the legacy manifest type label as a keyword fallback when the remote label was normalized', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'atelie-orbita',
          title: 'Atelie Orbita',
          type_label: 'Agency',
          poster_url: 'https://example.com/remote-atelie-orbita.webp',
          preview_url: 'https://example.com/remote-atelie-orbita.gif',
          preview_kind: 'image',
          preview_width: 1200,
          preview_height: 1600,
          is_active: true,
          is_public: true,
          sort_order: 1,
        },
      ],
      error: null,
    })

    const secondEq = vi.fn(() => ({ order }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const select = vi.fn(() => ({ eq: firstEq }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(refreshCatalogMetadata()).resolves.toEqual([
      {
        slug: 'atelie-orbita',
        title: 'Atelie Orbita',
        typeLabel: 'Agency',
        keywords: ['Estudio'],
        posterUrl: '/card-posters/atelie-orbita.webp',
        animatedPreviewUrl:
          'https://d39qrw7a9vnyeo.cloudfront.net/cards/atelie-orbita/preview-gif-20260402-201043-7a6984.gif',
        animatedPreviewKind: 'image',
        previewWidth: 480,
        previewHeight: 339,
        isPublic: true,
      },
    ])
  })

  it('reads markdown content by slug from the public table', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { content_markdown: '# markdown' },
      error: null,
    })
    const thirdEq = vi.fn(() => ({ single }))
    const secondEq = vi.fn(() => ({ eq: thirdEq }))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const select = vi.fn(() => ({ eq: firstEq }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(getCatalogContent('atelie-orbita')).resolves.toBe('# markdown')

    expect(from).toHaveBeenCalledWith('catalog_prompts')
    expect(select).toHaveBeenCalledWith('content_markdown')
    expect(firstEq).toHaveBeenCalledWith('slug', 'atelie-orbita')
    expect(secondEq).toHaveBeenCalledWith('is_public', true)
    expect(thirdEq).toHaveBeenCalledWith('is_active', true)
  })

  it('falls back to the legacy catalog schema when poster columns are not available', async () => {
    const activeLegacyOrder = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'taskly-hero',
          title: 'Taskly',
          type_label: 'Productivity',
          preview_url: 'https://example.com/taskly.gif',
          preview_kind: 'image',
          is_active: true,
          is_public: true,
          sort_order: 1,
        },
      ],
      error: null,
    })
    const activeLegacySecondEq = vi.fn(() => ({ order: activeLegacyOrder }))
    const activeLegacyFirstEq = vi.fn(() => ({ eq: activeLegacySecondEq }))
    const fullOrder = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'column catalog_prompts.poster_url does not exist',
      },
    })
    const fullSecondEq = vi.fn(() => ({ order: fullOrder }))
    const fullFirstEq = vi.fn(() => ({ eq: fullSecondEq }))
    const select = vi
      .fn()
      .mockImplementationOnce(() => ({ eq: fullFirstEq }))
      .mockImplementationOnce(() => ({ eq: activeLegacyFirstEq }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(refreshCatalogMetadata()).resolves.toEqual([
      {
        slug: 'taskly-hero',
        title: 'Taskly',
        typeLabel: 'Productivity',
        posterUrl: '/motionsites-posters/taskly-hero.webp',
        animatedPreviewUrl: '/motionsites-previews/taskly-hero.gif',
        animatedPreviewKind: 'image',
        previewWidth: 800,
        previewHeight: 592,
        isPublic: true,
      },
    ])

    expect(select).toHaveBeenNthCalledWith(
      1,
      'slug, title, type_label, reference_lookup, poster_url, preview_url, preview_kind, preview_width, preview_height, is_active, is_public, sort_order',
    )
    expect(select).toHaveBeenNthCalledWith(
      2,
      'slug, title, type_label, preview_url, preview_kind, is_active, is_public, sort_order',
    )
  })
})
