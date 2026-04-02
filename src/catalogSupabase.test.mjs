import { describe, expect, it, vi } from 'vitest'
import {
  buildCatalogUpsertPayload,
  getMotionSitesLookupSlug,
  loadCatalogInventory,
  normalizeCatalogReferenceLookup,
} from '../scripts/lib/catalog-supabase.mjs'

describe('catalog supabase helpers', () => {
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
      'slug, title, type_label, sort_order, is_public, required_plan, published_at, poster_url, preview_url, preview_kind, preview_width, preview_height, reference_lookup',
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
    const legacySelect = vi.fn(() => ({ order: legacyOrder }))
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
})
