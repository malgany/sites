import { jsonResponse, handleCorsPreflightRequest } from '../_shared/http.ts'
import type { ServiceClient, UserClient } from '../_shared/types.ts'

type CatalogContentDeps = {
  createServiceClient: () => ServiceClient
  createUserClient: (authorizationHeader: string | null) => UserClient
}

function normalizeSlug(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

export function createCatalogContentHandler(deps: CatalogContentDeps) {
  return async function handleCatalogContent(request: Request) {
    const corsResponse = handleCorsPreflightRequest(request)

    if (corsResponse) {
      return corsResponse
    }

    if (request.method !== 'POST') {
      return jsonResponse(405, {
        error: 'Method not allowed.',
      })
    }

    try {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
      const slug = normalizeSlug(body.slug)

      if (!slug) {
        return jsonResponse(400, {
          error: 'A valid slug is required.',
        })
      }

      const serviceClient = deps.createServiceClient()
      const contentLookup = await serviceClient
        .from('catalog_prompts')
        .select('slug, content_markdown, required_plan, is_public, is_active')
        .eq('slug', slug)
        .maybeSingle()

      if (contentLookup.error) {
        throw new Error(contentLookup.error.message)
      }

      if (!contentLookup.data || !contentLookup.data.is_active || !contentLookup.data.is_public) {
        return jsonResponse(404, {
          error: 'Catalog content not found.',
        })
      }

      if (!contentLookup.data.required_plan) {
        return jsonResponse(200, {
          contentMarkdown: contentLookup.data.content_markdown,
          slug: contentLookup.data.slug,
        })
      }

      const userClient = deps.createUserClient(request.headers.get('Authorization'))
      const {
        data: { user },
      } = await userClient.auth.getUser()

      if (!user) {
        return jsonResponse(403, {
          error: 'Premium access required.',
        })
      }

      const accessLookup = await serviceClient
        .from('user_access')
        .select('plan_code, status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (accessLookup.error) {
        throw new Error(accessLookup.error.message)
      }

      if (
        accessLookup.data?.status !== 'active' ||
        accessLookup.data?.plan_code !== contentLookup.data.required_plan
      ) {
        return jsonResponse(403, {
          error: 'Premium access required.',
        })
      }

      return jsonResponse(200, {
        contentMarkdown: contentLookup.data.content_markdown,
        slug: contentLookup.data.slug,
      })
    } catch (error) {
      console.error('Could not load catalog content.', error)
      return jsonResponse(500, {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load catalog content.',
      })
    }
  }
}
