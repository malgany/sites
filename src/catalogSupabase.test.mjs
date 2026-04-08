import { describe, expect, it, vi } from 'vitest'
import {
  applyPromptMediaLinksToMarkdown,
  buildCatalogUpsertPayload,
  getMotionSitesLookupSlug,
  getMissingCatalogColumnName,
  loadCatalogInventory,
  normalizeCatalogReferenceLookup,
  upsertCatalogWithSchemaFallback,
} from '../scripts/lib/catalog-supabase.mjs'

describe('catalog supabase helpers', () => {
  it('replaces prompt video links using the configured media link for the same slug', () => {
    const markdown = `
      <video src="https://d39qrw7a9vnyeo.cloudfront.net/cards/asme-vidro-liquido/prompt-video-20260407-050552-19f892.mp4"></video>
    `

    const updated = applyPromptMediaLinksToMarkdown({
      markdown,
      promptMediaLink: {
        mp4Url:
          'https://d39qrw7a9vnyeo.cloudfront.net/cards/asme-vidro-liquido/prompt-video-20260403-022529-eac753.mp4',
      },
      slug: 'asme-vidro-liquido',
    })

    expect(updated).toContain(
      'https://d39qrw7a9vnyeo.cloudfront.net/cards/asme-vidro-liquido/prompt-video-20260403-022529-eac753.mp4',
    )
    expect(updated).not.toContain(
      'https://d39qrw7a9vnyeo.cloudfront.net/cards/asme-vidro-liquido/prompt-video-20260407-050552-19f892.mp4',
    )
  })

  it('matches multi-section prompt videos by section key when links are configured', () => {
    const markdown = `
      hero: https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-hero-20260407-001111-aaaaaa.mp4
      mission: https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-mission-20260407-001112-bbbbbb.mp4
      solution: https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-solution-20260407-001113-cccccc.mp4
      cta: https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-cta-20260407-001114-dddddd.mp4
    `

    const updated = applyPromptMediaLinksToMarkdown({
      markdown,
      promptMediaLink: {
        mp4Url:
          'https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-hero-20260403-031801-a91f2a.mp4',
        videos: {
          hero: {
            mp4Url:
              'https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-hero-20260403-031801-a91f2a.mp4',
          },
          mission: {
            mp4Url:
              'https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-mission-20260403-031818-b57c4d.mp4',
          },
          solution: {
            mp4Url:
              'https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-solution-20260403-031833-f04d91.mp4',
          },
          cta: {
            mp4Url:
              'https://d39qrw7a9vnyeo.cloudfront.net/cards/mindloop-operacao-unificada/prompt-video-cta-20260403-031850-c7318b.mp4',
          },
        },
      },
      slug: 'mindloop-operacao-unificada',
    })

    expect(updated).toContain('prompt-video-hero-20260403-031801-a91f2a.mp4')
    expect(updated).toContain('prompt-video-mission-20260403-031818-b57c4d.mp4')
    expect(updated).toContain('prompt-video-solution-20260403-031833-f04d91.mp4')
    expect(updated).toContain('prompt-video-cta-20260403-031850-c7318b.mp4')
    expect(updated).not.toContain('prompt-video-hero-20260407-001111-aaaaaa.mp4')
    expect(updated).not.toContain('prompt-video-mission-20260407-001112-bbbbbb.mp4')
    expect(updated).not.toContain('prompt-video-solution-20260407-001113-cccccc.mp4')
    expect(updated).not.toContain('prompt-video-cta-20260407-001114-dddddd.mp4')
  })

  it('normalizes reference lookup fields and falls back to the catalog title', () => {
    expect(
      normalizeCatalogReferenceLookup(
        {
          motionSitesSlug: '  custom-site-id  ',
          keywords: ['  AI ', '', 'AI', 'Landing'],
          motionSitesTitle: '  MotionSites Title  ',
          preferredSource: 'motion_videos',
        },
        'Fallback Title',
      ),
    ).toEqual({
      keywords: ['AI', 'Landing'],
      motionSitesSlug: 'custom-site-id',
      motionSitesTitle: 'MotionSites Title',
      preferredSource: 'motion_videos',
    })

    expect(normalizeCatalogReferenceLookup(null, 'Fallback Title')).toEqual({
      motionSitesTitle: 'Fallback Title',
    })
  })

  it('loads and maps the catalog inventory from Supabase', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'ai-designer-agency',
          title: 'AI Designer Agency',
          type_label: 'Agency',
          sort_order: 3,
          is_active: true,
          is_public: true,
          required_plan: null,
          published_at: '2026-04-01T10:00:00.000Z',
          poster_url: '/motionsites-posters/ai-designer-agency.webp',
          preview_url: 'https://cdn.example.com/ai-designer-agency.gif',
          preview_kind: 'image',
          preview_width: 455,
          preview_height: 800,
          reference_lookup: {
            motionSitesSlug: 'custom-ai-designer-agency',
          },
        },
      ],
      error: null,
    })
    const select = vi.fn(() => ({ order }))
    const from = vi.fn(() => ({ select }))

    const items = await loadCatalogInventory({
      supabase: { from },
    })

    expect(items).toEqual([
      {
        slug: 'ai-designer-agency',
        title: 'AI Designer Agency',
        typeLabel: 'Agency',
        sortOrder: 3,
        visibility: 'public',
        isActive: true,
        isPublic: true,
        requiredPlan: null,
        publishedAt: '2026-04-01T10:00:00.000Z',
        posterUrl: '/motionsites-posters/ai-designer-agency.webp',
        previewUrl: 'https://cdn.example.com/ai-designer-agency.gif',
        previewKind: 'image',
        previewWidth: 455,
        previewHeight: 800,
        referenceLookup: {
          motionSitesSlug: 'custom-ai-designer-agency',
          motionSitesTitle: 'AI Designer Agency',
        },
      },
    ])

    expect(from).toHaveBeenCalledWith('catalog_prompts')
    expect(select).toHaveBeenCalledWith(
      'slug, title, type_label, sort_order, is_active, is_public, required_plan, published_at, poster_url, preview_url, preview_kind, preview_width, preview_height, reference_lookup',
    )
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true })
  })

  it('falls back to the legacy Supabase schema when the new columns are not available', async () => {
    const legacyOrder = vi.fn().mockResolvedValue({
      data: [
        {
          slug: 'mindloop-hero',
          title: 'Mindloop',
          type_label: 'SaaS',
          sort_order: 31,
          is_public: true,
          required_plan: null,
          published_at: null,
          preview_url: 'https://cdn.example.com/mindloop.gif',
          preview_kind: 'image',
        },
      ],
      error: null,
    })
    const activeLegacyOrder = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          "Could not find the 'is_active' column of 'catalog_prompts' in the schema cache",
      },
    })
    const legacySelect = vi.fn(() => ({ order: legacyOrder }))
    const activeLegacySelect = vi.fn(() => ({ order: activeLegacyOrder }))
    const fullOrder = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'column catalog_prompts.poster_url does not exist',
      },
    })
    const fullSelect = vi.fn(() => ({ order: fullOrder }))
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({ select: fullSelect }))
      .mockImplementationOnce(() => ({ select: activeLegacySelect }))
      .mockImplementationOnce(() => ({ select: legacySelect }))

    const items = await loadCatalogInventory({
      supabase: { from },
    })

    expect(items).toEqual([
      {
        slug: 'mindloop-hero',
        title: 'Mindloop',
        typeLabel: 'SaaS',
        sortOrder: 31,
        visibility: 'public',
        isActive: true,
        isPublic: true,
        requiredPlan: null,
        publishedAt: null,
        posterUrl: null,
        previewUrl: 'https://cdn.example.com/mindloop.gif',
        previewKind: 'image',
        previewWidth: null,
        previewHeight: null,
        referenceLookup: {
          motionSitesTitle: 'Mindloop',
        },
      },
    ])
  })

  it('builds the sync upsert payload from the Supabase-owned inventory row', () => {
    const payload = buildCatalogUpsertPayload({
      item: {
        slug: 'skyelite-hero',
        title: 'SkyElite Private Jets',
        typeLabel: 'Luxury',
        sortOrder: 48,
        visibility: 'private',
        isActive: true,
        isPublic: false,
        requiredPlan: 'enterprise',
        publishedAt: '2026-04-01T10:00:00.000Z',
        posterUrl: '/motionsites-posters/skyelite-hero.webp',
        previewUrl: 'https://cdn.example.com/original.gif',
        previewKind: 'image',
        previewWidth: 455,
        previewHeight: 800,
        referenceLookup: {
          motionSitesSlug: 'skyelite-private-jets',
          motionSitesTitle: 'SkyElite Private Jets',
        },
      },
      localPreviewOverride: {
        previewKind: 'image',
        previewUrl: '/motionsites-previews/skyelite-hero.gif',
        animatedPreviewKind: 'image',
        animatedPreviewUrl: '/motionsites-previews/skyelite-hero.gif',
        posterUrl: '/motionsites-posters/skyelite-override.webp',
        previewWidth: 1100,
        previewHeight: 2000,
      },
      promptText: '# Premium jets',
      resolvedPreviewKind: 'video',
      resolvedPreviewUrl: 'https://cdn.example.com/updated.mp4',
      siteEntry: {
        id: 'skyelite-private-jets',
        previewKind: 'image',
      },
    })

    expect(payload).toMatchObject({
      slug: 'skyelite-hero',
      title: 'SkyElite Private Jets',
      type_label: 'Luxury',
      content_markdown: '# Premium jets',
      is_active: true,
      is_public: false,
      poster_url: '/motionsites-posters/skyelite-override.webp',
      preview_kind: 'image',
      preview_url: '/motionsites-previews/skyelite-hero.gif',
      preview_width: 1100,
      preview_height: 2000,
      published_at: '2026-04-01T10:00:00.000Z',
      required_plan: 'enterprise',
      sort_order: 48,
      source_file_name: 'motionsites:skyelite-private-jets',
      reference_lookup: {
        motionSitesSlug: 'skyelite-private-jets',
        motionSitesTitle: 'SkyElite Private Jets',
      },
    })

    expect(payload.source_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(getMotionSitesLookupSlug({ slug: 'fallback', referenceLookup: {} })).toBe(
      'fallback',
    )
  })

  it('applies prompt media links while building the sync upsert payload', () => {
    const payload = buildCatalogUpsertPayload({
      item: {
        slug: 'asme-vidro-liquido',
        title: 'Asme Vidro Liquido',
        typeLabel: 'Landing',
        sortOrder: 10,
        visibility: 'public',
        isActive: true,
        isPublic: true,
        requiredPlan: null,
        publishedAt: '2026-04-01T10:00:00.000Z',
        posterUrl: null,
        previewUrl: null,
        previewKind: 'image',
        previewWidth: null,
        previewHeight: null,
        referenceLookup: {},
      },
      localPreviewOverride: null,
      promptMediaLink: {
        mp4Url:
          'https://d39qrw7a9vnyeo.cloudfront.net/cards/asme-vidro-liquido/prompt-video-20260403-022529-eac753.mp4',
      },
      promptText:
        'video: https://d39qrw7a9vnyeo.cloudfront.net/cards/asme-vidro-liquido/prompt-video-20260407-050552-19f892.mp4',
      resolvedPreviewKind: 'image',
      resolvedPreviewUrl: null,
      siteEntry: {
        id: 'asme-vidro-liquido',
        previewKind: 'image',
      },
    })

    expect(payload.content_markdown).toContain('prompt-video-20260403-022529-eac753.mp4')
    expect(payload.content_markdown).not.toContain('prompt-video-20260407-050552-19f892.mp4')
  })

  it('detects missing catalog columns from both PostgREST error formats', () => {
    expect(
      getMissingCatalogColumnName({
        message: 'column catalog_prompts.poster_url does not exist',
      }),
    ).toBe('poster_url')

    expect(
      getMissingCatalogColumnName({
        message:
          "Could not find the 'poster_url' column of 'catalog_prompts' in the schema cache",
      }),
    ).toBe('poster_url')
  })

  it('retries catalog upserts without unsupported columns', async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          message:
            "Could not find the 'poster_url' column of 'catalog_prompts' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        error: null,
      })
    const from = vi.fn(() => ({ upsert }))

    await expect(
      upsertCatalogWithSchemaFallback({
        payload: {
          slug: 'atelie-orbita',
          poster_url: '/card-posters/atelie-orbita.webp',
          preview_url: '/card-gifs/atelie-orbita.gif',
        },
        supabase: { from },
      }),
    ).resolves.toEqual({
      unsupportedColumns: ['poster_url'],
    })

    expect(upsert).toHaveBeenNthCalledWith(
      1,
      {
        slug: 'atelie-orbita',
        poster_url: '/card-posters/atelie-orbita.webp',
        preview_url: '/card-gifs/atelie-orbita.gif',
      },
      {
        onConflict: 'slug',
      },
    )
    expect(upsert).toHaveBeenNthCalledWith(
      2,
      {
        slug: 'atelie-orbita',
        preview_url: '/card-gifs/atelie-orbita.gif',
      },
      {
        onConflict: 'slug',
      },
    )
  })
})
