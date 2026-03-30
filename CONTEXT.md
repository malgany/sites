# Project Context

## Overview
- Project name: `sites`
- Purpose: single-page component showcase inspired by `motionsites.ai`
- Output: a gallery of 21 React + Tailwind section prompts with local preview images and instant copy-to-clipboard behavior
- Language: English UI and English prompts

## Stack
- Vite
- React 19
- TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- Vitest + React Testing Library

## Product Direction
- Visual reference was derived from direct inspection of `motionsites.ai`
- The site uses a dark premium palette, near-white text, muted gray secondary text, rounded surfaces, and saturated blue accents
- This implementation adapts that style to a component prompt gallery rather than cloning the original content model

## Main Behavior
- Top section with title, subtitle, and summary stats
- Search input with placeholder `Search components or categories`
- Category tabs:
  - `All`
  - `Hero`
  - `CTA`
  - `Pricing`
  - `Testimonials`
  - `Features`
  - `FAQ`
  - `Footer`
- Responsive grid:
  - mobile: 1 column
  - tablet: 2 columns
  - desktop: 4 columns
- Each card includes:
  - static local preview image
  - title
  - category
  - optional badge (`Popular` or `New`)
  - `Copy prompt` button
- Copy behavior:
  - tries `navigator.clipboard.writeText`
  - falls back to `document.execCommand('copy')`
  - shows `Copied` for 2 seconds on success
  - shows `Copy failed` on failure

## Source Structure
- `src/App.tsx`
  - page composition and local UI state
- `src/components/CategoryTabs.tsx`
  - tab/filter navigation
- `src/components/ComponentCard.tsx`
  - individual gallery card UI
- `src/data/components.ts`
  - typed catalog of categories, badges, prompts, and local preview paths
- `src/lib/filterComponents.ts`
  - pure helper for category + query filtering
- `src/lib/copyTextToClipboard.ts`
  - clipboard helper with fallback
- `src/index.css`
  - Tailwind import and project design tokens
- `scripts/generate-previews.mjs`
  - local generator for the 21 `.webp` preview images
- `public/previews`
  - generated static preview assets used by the cards

## Type Model
- `CategoryId = 'all' | 'hero' | 'cta' | 'pricing' | 'testimonials' | 'features' | 'faq' | 'footer'`
- `Badge = 'New' | 'Popular' | null`
- `ComponentItem = { id, title, category, image, badge, prompt }`

## Commands
- Install deps: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm run test`
- Regenerate preview assets: `npm run generate:previews`

## Test Coverage
- `src/App.test.tsx`
  - initial render
  - category filtering
  - search behavior
  - empty state
  - copy success state
  - copy error state
  - keyboard tab activation
- `src/lib/filterComponents.test.ts`
  - pure filter logic
- `src/lib/copyTextToClipboard.test.ts`
  - clipboard primary path
  - fallback path
  - failure path

## Repository Notes
- `dist/`, `node_modules/`, local logs, env files, caches, and `.agents/` are ignored by Git
- The repository was initialized after implementation hygiene was added
