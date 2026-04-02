# Project Context

## Overview
- Project name: `sites`
- Purpose: public prompt catalog inspired by `motionsites.ai`
- Output: a Supabase-backed gallery of website prompts with remote preview media and copy-on-demand Markdown mirrored from `motionsites.ai`
- Language: English UI and English prompt content

## Stack
- Vite
- React 19
- TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- Supabase JS
- Vitest + React Testing Library

## Product Direction
- Visual reference was derived from direct inspection of `motionsites.ai`
- The UI keeps a premium editorial layout with soft surfaces, near-black type, muted gray metadata, and compact high-contrast actions
- The current implementation keeps the browsing feel but mirrors the publicly-available MotionSites prompts directly from the live site

## Architecture Decision
- Public catalog reads happen directly in the browser with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
- The listing view fetches only card metadata
- Full Markdown is fetched on demand per card via `getCatalogContent(slug)`
- `SUPABASE_SERVICE_ROLE_KEY` is reserved for the sync/import script only
- Prompt content and preview metadata are pulled from the live `motionsites.ai` site bundle and `get-prompt` Edge Function
- Future private content should keep the same UI but move the content fetch path behind authenticated server-side logic or Edge Functions

## Main Behavior
- Top section with title, subtitle, and summary stats
- Search input with placeholder `Search prompts or types`
- Responsive masonry-style grid:
  - mobile: 1 column
  - tablet: 2 columns
  - desktop: 4 columns
- Each card includes:
  - remote preview image or looped video
  - title
  - configured `typeLabel`
  - public/private status label
  - `Copy` button
- Copy behavior:
  - fetches the raw Markdown for the selected slug from Supabase
  - tries `navigator.clipboard.writeText`
  - falls back to `document.execCommand('copy')`
  - shows `Copied` for 2 seconds on success
  - shows `Copy failed` on failure

## Content Model
- Runtime and operational source of truth: `public.catalog_prompts` in Supabase
- Supabase table: `public.catalog_prompts`
- Table fields:
  - `slug`
  - `title`
  - `type_label`
  - `content_markdown`
  - `reference_lookup`
  - `poster_url`
  - `preview_url`
  - `preview_kind`
  - `preview_width`
  - `preview_height`
  - `source_file_name`
  - `source_hash`
  - `sort_order`
  - `is_public`
  - `required_plan`
  - `published_at`
  - timestamps

## Source Structure
- `src/App.tsx`
  - page composition, cached Supabase catalog loading, and copy state
- `src/components/ComponentCard.tsx`
  - gallery card UI with image/video preview handling
- `src/catalog/catalog-manifest.json`
  - legacy catalog archive retained in the repo, no longer used by runtime or operational scripts
- `src/catalog/manifest.ts`
  - legacy manifest validation helper
- `src/catalog/client.ts`
  - browser Supabase client bootstrap
- `src/catalog/repository.ts`
  - public Supabase read layer for cards and Markdown content, with legacy-schema fallback
- `src/catalog/cache.ts`
  - browser localStorage cache for stale-while-refresh catalog hydration
- `src/lib/filterCatalog.ts`
  - pure helper for title/type filtering
- `src/lib/copyTextToClipboard.ts`
  - clipboard helper with fallback
- `scripts/sync-catalog-to-supabase.mjs`
  - sync/import pipeline from the live MotionSites site into Supabase using Supabase catalog inventory
- `scripts/compare-motionsites-catalog.mjs`
  - compares the live MotionSites site catalog and prompt availability against the Supabase catalog inventory
- `scripts/download-motionsites-previews.mjs`
  - downloads MotionSites previews for the current Supabase catalog inventory into local overrides
- `scripts/lib/catalog-supabase.mjs`
  - shared Supabase inventory loader and sync ownership helpers for catalog scripts
- `scripts/lib/catalog-sync-utils.mjs`
  - file resolution, URL extraction, hashing, and asset helper logic
- `scripts/lib/motionsites-site-catalog.mjs`
  - extracts the live MotionSites catalog, public Supabase config, and prompt availability helpers from the current site bundle
- `supabase/bootstrap/catalog_public_catalog.sql`
  - table, RLS, and public bucket bootstrap

## Type Model
- `CatalogManifestItem = { slug, title, typeLabel, sortOrder, visibility, referenceLookup }`
- `CatalogCardItem = { slug, title, typeLabel, posterUrl, animatedPreviewUrl, animatedPreviewKind, previewWidth, previewHeight, isPublic }`
- `CatalogCopyState = 'idle' | 'pending' | 'copied' | 'error'`

## Commands
- Install deps: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm run test`
- Sync live MotionSites prompts + previews to Supabase: `npm run sync:catalog`
- Compare the Supabase catalog inventory against the live MotionSites site: `npm run compare:motionsites-catalog`
- Download MotionSites previews for the Supabase catalog inventory: `npm run download:motionsites-previews`
- Regenerate old local preview assets: `npm run generate:previews`

## Test Coverage
- `src/App.test.tsx`
  - loading state
  - Supabase-backed render
  - search behavior
  - empty state
  - copy success state
  - copy error state
  - catalog load error state
- `src/catalog/repository.test.ts`
  - public list query mapping
  - on-demand Markdown query
- `src/lib/filterCatalog.test.ts`
  - pure search logic
- `src/catalogSyncUtils.test.mjs`
  - latest Markdown resolution by slug
  - media URL extraction
  - preview kind inference and stable hashing
- `src/motionsitesSiteCatalog.test.mjs`
  - MotionSites bundle path parsing
  - card metadata parsing
  - public Supabase config extraction
- `src/lib/copyTextToClipboard.test.ts`
  - clipboard primary path
  - fallback path
  - failure path

## Repository Notes
- `dist/`, `node_modules/`, local logs, env files, caches, and `.agents/` are ignored by Git
- The runtime no longer depends on `catalog-manifest.json` or `local-preview-overrides.json`
- Operational scripts now load catalog inventory from Supabase and keep a fallback read path for legacy schemas that do not yet have the newer preview columns

## Prompt Adaptation Rule
- For MotionSites-derived cards, the original live prompt is the highest-fidelity reference for what must appear on screen
- When adapting a card locally, preserve the original prompt scaffold as closely as possible, including layout, colors, spacing, typography, animation, and structure
- Only change hosted media URLs, visible site copy, and brand names when they appear in the rendered UI
- Do not rewrite or translate the instructional scaffold unless the user explicitly asks for that
