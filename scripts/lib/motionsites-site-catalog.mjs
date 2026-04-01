import { createClient } from '@supabase/supabase-js'
import { inferPreviewKindFromUrl, normalizeLookupValue } from './catalog-sync-utils.mjs'

export const DEFAULT_MOTIONSITES_SITE_URL = 'https://motionsites.ai/'

export async function fetchMotionSitesSiteCatalog({
  siteUrl = DEFAULT_MOTIONSITES_SITE_URL,
} = {}) {
  const html = await fetchText(siteUrl)
  const bundleUrl = resolveMotionSitesBundleUrl(html, siteUrl)
  const bundle = await fetchText(bundleUrl)
  const { supabaseAnonKey, supabaseUrl } = extractMotionSitesSupabaseConfig(bundle)

  return {
    bundleUrl,
    items: parseMotionSitesCatalogBundle(bundle, siteUrl),
    siteUrl: new URL(siteUrl).toString(),
    supabaseAnonKey,
    supabaseUrl,
  }
}

export function resolveMotionSitesBundleUrl(
  html,
  siteUrl = DEFAULT_MOTIONSITES_SITE_URL,
) {
  const bundlePathMatch = String(html ?? '').match(
    /<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i,
  )

  if (!bundlePathMatch) {
    throw new Error('Could not find the MotionSites client bundle path.')
  }

  return new URL(bundlePathMatch[1], siteUrl).toString()
}

export function parseMotionSitesCatalogBundle(
  bundle,
  siteUrl = DEFAULT_MOTIONSITES_SITE_URL,
) {
  const assetPaths = buildMotionSitesAssetPathMap(bundle, siteUrl)
  const items = []
  const cardRegex =
    /\{id:"([^"]+)",title:"([^"]+)",image:([A-Za-z$_][A-Za-z0-9$_]*)([^{}]*?)\}/g

  for (const match of String(bundle ?? '').matchAll(cardRegex)) {
    const [, id, title, imageVariable, extras] = match
    const previewUrl = assetPaths.get(imageVariable)

    if (!previewUrl) {
      continue
    }

    const category = extras.match(/category:"([^"]+)"/)?.[1] ?? null
    const type = extras.match(/type:"([^"]+)"/)?.[1] ?? null
    const posterVariable =
      extras.match(/poster:([A-Za-z$_][A-Za-z0-9$_]*)/)?.[1] ?? null
    const posterUrl = posterVariable ? assetPaths.get(posterVariable) ?? null : null
    const isFree = extras.includes('free:!0')
      ? true
      : extras.includes('free:!1')
        ? false
        : null

    items.push({
      category,
      id,
      isFree,
      posterUrl,
      previewKind: inferPreviewKindFromUrl(previewUrl),
      previewUrl,
      searchText: normalizeLookupValue(
        `${id} ${title} ${category ?? ''} ${type ?? ''}`,
      ),
      title,
      type,
    })
  }

  return items
}

export function extractMotionSitesSupabaseConfig(bundle) {
  const supabaseUrl = String(bundle ?? '').match(
    /https:\/\/[a-z0-9-]+\.supabase\.co/gi,
  )?.[0]
  const supabaseAnonKey = String(bundle ?? '').match(
    /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+/g,
  )?.[0]

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Could not extract the MotionSites Supabase URL and anon key from the site bundle.',
    )
  }

  return {
    supabaseAnonKey,
    supabaseUrl,
  }
}

export function createMotionSitesPublicClient({
  supabaseAnonKey,
  supabaseUrl,
}) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function fetchMotionSitesPrompt({
  client,
  promptId,
}) {
  const { data, error } = await client.functions.invoke('get-prompt', {
    body: {
      prompt_id: promptId,
    },
  })

  return {
    code: data?.code ?? null,
    error: error?.message ?? null,
    promptText: data?.prompt_text ?? null,
  }
}

export async function fetchMotionSitesPromptMap({
  client,
  promptIds,
  concurrency = 4,
}) {
  const queue = [...new Set(promptIds.filter(Boolean))]
  const promptMap = new Map()
  const workerCount = Math.max(1, Math.min(concurrency, queue.length || 1))

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (queue.length) {
        const promptId = queue.shift()

        if (!promptId) {
          continue
        }

        promptMap.set(
          promptId,
          await fetchMotionSitesPrompt({
            client,
            promptId,
          }),
        )
      }
    }),
  )

  return promptMap
}

function buildMotionSitesAssetPathMap(
  bundle,
  siteUrl = DEFAULT_MOTIONSITES_SITE_URL,
) {
  const assetMap = new Map()
  const assetRegex =
    /([A-Za-z$_][A-Za-z0-9$_]*)="(\/assets\/[^"]+\.(?:gif|png|jpe?g|webp|avif))"/g

  for (const match of String(bundle ?? '').matchAll(assetRegex)) {
    const [, variableName, assetPath] = match
    assetMap.set(variableName, new URL(assetPath, siteUrl).toString())
  }

  return assetMap
}

async function fetchText(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}
