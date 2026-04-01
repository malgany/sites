import { describe, expect, it } from 'vitest'
import {
  extractMotionSitesSupabaseConfig,
  parseMotionSitesCatalogBundle,
  resolveMotionSitesBundleUrl,
} from '../scripts/lib/motionsites-site-catalog.mjs'

describe('motionsites site catalog', () => {
  it('resolves the active MotionSites client bundle from HTML', () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <script type="module" crossorigin src="/assets/index-C3EnAujr.js"></script>
        </body>
      </html>
    `

    expect(resolveMotionSitesBundleUrl(html)).toBe(
      'https://motionsites.ai/assets/index-C3EnAujr.js',
    )
  })

  it('parses MotionSites card metadata from the bundle', () => {
    const bundle = `
      const heroPreview="/assets/hero-preview.gif";
      const heroPoster="/assets/hero-poster.png";
      const landingPreview="/assets/landing-preview.png";
      const rows=[
        {id:"taskly-hero",title:"Taskly",image:heroPreview,poster:heroPoster,category:"Hero Section",type:"hero",free:!0},
        {id:"orbit-engineers",title:"Orbit Engineers",image:landingPreview,poster:landingPreview,category:"Agency",type:"landing-page"}
      ];
    `

    expect(parseMotionSitesCatalogBundle(bundle)).toEqual([
      {
        category: 'Hero Section',
        id: 'taskly-hero',
        isFree: true,
        posterUrl: 'https://motionsites.ai/assets/hero-poster.png',
        previewKind: 'image',
        previewUrl: 'https://motionsites.ai/assets/hero-preview.gif',
        searchText: 'taskly hero taskly hero section hero',
        title: 'Taskly',
        type: 'hero',
      },
      {
        category: 'Agency',
        id: 'orbit-engineers',
        isFree: null,
        posterUrl: 'https://motionsites.ai/assets/landing-preview.png',
        previewKind: 'image',
        previewUrl: 'https://motionsites.ai/assets/landing-preview.png',
        searchText: 'orbit engineers orbit engineers agency landing page',
        title: 'Orbit Engineers',
        type: 'landing-page',
      },
    ])
  })

  it('extracts the MotionSites Supabase config from the bundle', () => {
    const bundle = `
      const siteUrl="https://xgdzyqfalbibzelpdpvr.supabase.co";
      const anonKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def";
    `

    expect(extractMotionSitesSupabaseConfig(bundle)).toEqual({
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def',
      supabaseUrl: 'https://xgdzyqfalbibzelpdpvr.supabase.co',
    })
  })
})
