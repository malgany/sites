import { createServiceClient, createUserClient } from '../_shared/supabase.ts'
import { createCatalogContentHandler } from './handler.ts'

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void
}

Deno.serve(
  createCatalogContentHandler({
    createServiceClient,
    createUserClient,
  }),
)
