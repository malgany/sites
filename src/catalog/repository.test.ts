import { describe, expect, it, vi } from 'vitest'
import { getBrowserAuthSupabaseClient } from '../auth/client'
import { getBrowserSupabaseClient } from './client'
import { getCatalogContent, refreshCatalogMetadata } from './repository'

vi.mock('./client', () => ({
  getBrowserSupabaseClient: vi.fn(),
}))

vi.mock('../auth/client', () => ({
  getBrowserAuthSupabaseClient: vi.fn(),
}))

const mockedGetBrowserSupabaseClient = vi.mocked(getBrowserSupabaseClient)
const mockedGetBrowserAuthSupabaseClient = vi.mocked(getBrowserAuthSupabaseClient)

describe('catalog repository', () => {
  it('maps the remote catalog rows from the public view into card metadata', async () => {
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
          is_public: true,
          required_plan: null,
          sort_order: 3,
        },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ order }))
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
      requiredPlan: null,
    })

    expect(from).toHaveBeenCalledWith('catalog_public_catalog')
    expect(select).toHaveBeenCalledWith(
      'slug, title, type_label, reference_lookup, poster_url, preview_url, preview_kind, preview_width, preview_height, is_public, required_plan, sort_order',
    )
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
          is_public: true,
          required_plan: null,
          sort_order: 1,
        },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ order }))
    const from = vi.fn(() => ({ select }))

    mockedGetBrowserSupabaseClient.mockReturnValue({
      from,
    } as never)

    await expect(refreshCatalogMetadata()).resolves.toEqual([
      {
        slug: 'atelie-orbita',
        title: 'Atelie Orbita',
        typeLabel: 'Estudio',
        keywords: ['Estudio', 'Agency'],
        posterUrl: '/card-posters/atelie-orbita.webp',
        animatedPreviewUrl:
          'https://d39qrw7a9vnyeo.cloudfront.net/cards/atelie-orbita/preview-gif-20260402-201043-7a6984.gif',
        animatedPreviewKind: 'image',
        previewWidth: 480,
        previewHeight: 339,
        isPublic: true,
        requiredPlan: null,
      },
    ])
  })

  it('uses manifest keywords as a fallback when the remote row does not expose taxonomy aliases', async () => {
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
          is_public: true,
          required_plan: 'premium',
          sort_order: 1,
        },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ order }))
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
        requiredPlan: 'premium',
      },
    ])
  })

  it('loads markdown content from the protected edge function', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        contentMarkdown: '# markdown',
      },
      error: null,
    })
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'token-123',
        },
      },
      error: null,
    })

    mockedGetBrowserAuthSupabaseClient.mockReturnValue({
      auth: {
        getSession,
      },
      functions: {
        invoke,
      },
    } as never)

    await expect(getCatalogContent('atelie-orbita')).resolves.toBe('# markdown')

    expect(invoke).toHaveBeenCalledWith('catalog-content', {
      body: {
        slug: 'atelie-orbita',
      },
      headers: {
        Authorization: 'Bearer token-123',
      },
    })
  })
})
