import { describe, expect, it, vi } from 'vitest'
import { createCatalogContentHandler } from './handler.ts'

function createUserClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user,
        },
      }),
    },
  }
}

function createServiceClient(options: {
  accessRow?: Record<string, unknown> | null
  contentRow: Record<string, unknown> | null
}) {
  const contentMaybeSingle = vi.fn().mockResolvedValue({
    data: options.contentRow,
    error: null,
  })
  const accessMaybeSingle = vi.fn().mockResolvedValue({
    data: options.accessRow ?? null,
    error: null,
  })
  const from = vi.fn((table: string) => {
    if (table === 'catalog_prompts') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: contentMaybeSingle,
          })),
        })),
      }
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: accessMaybeSingle,
        })),
      })),
    }
  })

  return {
    client: {
      from,
    },
  }
}

describe('catalog-content handler', () => {
  it('returns public markdown without requiring auth for free cards', async () => {
    const handler = createCatalogContentHandler({
      createServiceClient: () =>
        createServiceClient({
          contentRow: {
            content_markdown: '# free',
            is_active: true,
            is_public: true,
            required_plan: null,
            slug: 'atelie-orbita',
          },
        }).client,
      createUserClient: () => createUserClient(null),
    })

    const response = await handler(
      new Request('https://example.com/catalog-content', {
        body: JSON.stringify({
          slug: 'atelie-orbita',
        }),
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      contentMarkdown: '# free',
      slug: 'atelie-orbita',
    })
  })

  it('returns premium markdown only when the user has active access', async () => {
    const handler = createCatalogContentHandler({
      createServiceClient: () =>
        createServiceClient({
          accessRow: {
            plan_code: 'premium',
            status: 'active',
          },
          contentRow: {
            content_markdown: '# premium',
            is_active: true,
            is_public: true,
            required_plan: 'premium',
            slug: 'nexora-hero',
          },
        }).client,
      createUserClient: () =>
        createUserClient({
          id: 'user-123',
        }),
    })

    const response = await handler(
      new Request('https://example.com/catalog-content', {
        body: JSON.stringify({
          slug: 'nexora-hero',
        }),
        headers: {
          Authorization: 'Bearer token',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      contentMarkdown: '# premium',
      slug: 'nexora-hero',
    })
  })

  it('blocks premium markdown when the account is missing active access', async () => {
    const handler = createCatalogContentHandler({
      createServiceClient: () =>
        createServiceClient({
          accessRow: null,
          contentRow: {
            content_markdown: '# premium',
            is_active: true,
            is_public: true,
            required_plan: 'premium',
            slug: 'nexora-hero',
          },
        }).client,
      createUserClient: () =>
        createUserClient({
          id: 'user-123',
        }),
    })

    const response = await handler(
      new Request('https://example.com/catalog-content', {
        body: JSON.stringify({
          slug: 'nexora-hero',
        }),
        headers: {
          Authorization: 'Bearer token',
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Premium access required.',
    })
  })
})
