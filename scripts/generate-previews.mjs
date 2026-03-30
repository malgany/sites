import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outputDir = path.resolve('public', 'previews')

const accentSets = {
  hero: ['#4263ff', '#7c8cff', '#93a6ff'],
  cta: ['#3660ff', '#5488ff', '#8cb2ff'],
  pricing: ['#6a7eff', '#4c63ff', '#8ea0ff'],
  testimonials: ['#5b73ff', '#7b8cff', '#a6b4ff'],
  features: ['#3658ff', '#5f7aff', '#88a0ff'],
  faq: ['#506fff', '#6f88ff', '#a2afff'],
  footer: ['#455cff', '#647fff', '#90a3ff'],
}

const items = [
  ['hero', 'ai-product-hero', 'AI Product Hero'],
  ['hero', 'agency-spotlight-hero', 'Agency Spotlight Hero'],
  ['hero', 'gradient-portfolio-hero', 'Gradient Portfolio Hero'],
  ['cta', 'split-cta-banner', 'Split CTA Banner'],
  ['cta', 'minimal-signup-cta', 'Minimal Signup CTA'],
  ['cta', 'dark-download-cta', 'Dark Download CTA'],
  ['pricing', 'startup-pricing-grid', 'Startup Pricing Grid'],
  ['pricing', 'agency-retainer-pricing', 'Agency Retainer Pricing'],
  ['pricing', 'usage-pricing-table', 'Usage Pricing Table'],
  ['testimonials', 'founder-quote-stack', 'Founder Quote Stack'],
  ['testimonials', 'video-testimonial-strip', 'Video Testimonial Strip'],
  ['testimonials', 'logo-review-wall', 'Logo Review Wall'],
  ['features', 'feature-bento-grid', 'Feature Bento Grid'],
  ['features', 'product-timeline-features', 'Product Timeline Features'],
  ['features', 'comparison-feature-grid', 'Comparison Feature Grid'],
  ['faq', 'accordion-faq-block', 'Accordion FAQ Block'],
  ['faq', 'two-column-faq', 'Two-Column FAQ'],
  ['faq', 'support-faq-panel', 'Support FAQ Panel'],
  ['footer', 'newsletter-footer', 'Newsletter Footer'],
  ['footer', 'multi-column-footer', 'Multi-Column Footer'],
  ['footer', 'minimal-legal-footer', 'Minimal Legal Footer'],
]

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function renderHero(accent, variant) {
  const shifts = [
    ['76', '112', '160'],
    ['92', '138', '184'],
    ['84', '126', '176'],
  ][variant]

  return `
    <rect x="46" y="58" width="96" height="12" rx="6" fill="rgba(255,255,255,0.18)" />
    <rect x="46" y="96" width="238" height="18" rx="9" fill="rgba(255,255,255,0.94)" />
    <rect x="46" y="${shifts[0]}" width="208" height="18" rx="9" fill="rgba(255,255,255,0.82)" />
    <rect x="46" y="${shifts[1]}" width="152" height="12" rx="6" fill="rgba(255,255,255,0.34)" />
    <rect x="46" y="${shifts[2]}" width="128" height="36" rx="18" fill="${accent}" />
    <rect x="186" y="${shifts[2]}" width="100" height="36" rx="18" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.10)" />
    <rect x="364" y="74" width="216" height="204" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" />
    <rect x="388" y="98" width="168" height="18" rx="9" fill="rgba(255,255,255,0.16)" />
    <rect x="388" y="134" width="124" height="98" rx="20" fill="url(#accentGlow)" />
    <circle cx="540" cy="110" r="42" fill="rgba(255,255,255,0.06)" />
    <rect x="388" y="248" width="132" height="10" rx="5" fill="rgba(255,255,255,0.22)" />
  `
}

function renderCta(accent, variant) {
  const widths = [
    ['286', '120'],
    ['252', '132'],
    ['274', '116'],
  ][variant]

  return `
    <rect x="40" y="104" width="560" height="220" rx="34" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" />
    <rect x="68" y="140" width="${widths[0]}" height="22" rx="11" fill="rgba(255,255,255,0.95)" />
    <rect x="68" y="178" width="218" height="12" rx="6" fill="rgba(255,255,255,0.34)" />
    <rect x="68" y="204" width="188" height="12" rx="6" fill="rgba(255,255,255,0.20)" />
    <rect x="68" y="246" width="${widths[1]}" height="42" rx="21" fill="${accent}" />
    <rect x="428" y="142" width="136" height="42" rx="16" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
    <rect x="428" y="198" width="136" height="82" rx="22" fill="url(#accentGlow)" opacity="0.95" />
  `
}

function renderPricing(accent, variant) {
  const featuredX = ['252', '252', '430'][variant]

  return `
    <rect x="60" y="84" width="136" height="248" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <rect x="${featuredX}" y="62" width="136" height="270" rx="28" fill="rgba(66,99,255,0.16)" stroke="${accent}" />
    <rect x="428" y="84" width="136" height="248" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <rect x="84" y="112" width="68" height="12" rx="6" fill="rgba(255,255,255,0.22)" />
    <rect x="276" y="96" width="68" height="12" rx="6" fill="rgba(255,255,255,0.22)" />
    <rect x="452" y="112" width="68" height="12" rx="6" fill="rgba(255,255,255,0.22)" />
    <rect x="84" y="150" width="78" height="28" rx="14" fill="rgba(255,255,255,0.92)" />
    <rect x="276" y="138" width="92" height="32" rx="16" fill="rgba(255,255,255,0.96)" />
    <rect x="452" y="150" width="74" height="28" rx="14" fill="rgba(255,255,255,0.92)" />
    ${[0, 1, 2, 3]
      .map(
        (row) => `
      <rect x="84" y="${202 + row * 26}" width="88" height="8" rx="4" fill="rgba(255,255,255,0.18)" />
      <rect x="276" y="${196 + row * 30}" width="100" height="8" rx="4" fill="rgba(255,255,255,0.20)" />
      <rect x="452" y="${202 + row * 26}" width="90" height="8" rx="4" fill="rgba(255,255,255,0.18)" />
    `,
      )
      .join('')}
  `
}

function renderTestimonials(accent, variant) {
  const quoteWidths = ['220', '198', '236'][variant]

  return `
    <rect x="48" y="70" width="250" height="228" rx="28" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.07)" />
    <rect x="340" y="88" width="244" height="82" rx="24" fill="url(#accentGlow)" />
    <rect x="340" y="186" width="244" height="112" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" />
    <rect x="76" y="106" width="${quoteWidths}" height="14" rx="7" fill="rgba(255,255,255,0.94)" />
    <rect x="76" y="138" width="174" height="10" rx="5" fill="rgba(255,255,255,0.24)" />
    <rect x="76" y="158" width="184" height="10" rx="5" fill="rgba(255,255,255,0.18)" />
    <circle cx="88" cy="236" r="24" fill="${accent}" opacity="0.9" />
    <rect x="126" y="224" width="118" height="10" rx="5" fill="rgba(255,255,255,0.30)" />
    <rect x="126" y="244" width="96" height="10" rx="5" fill="rgba(255,255,255,0.18)" />
    <circle cx="388" cy="128" r="18" fill="rgba(255,255,255,0.88)" />
    <circle cx="442" cy="128" r="18" fill="rgba(255,255,255,0.28)" />
    <circle cx="496" cy="128" r="18" fill="rgba(255,255,255,0.18)" />
    <rect x="370" y="214" width="148" height="10" rx="5" fill="rgba(255,255,255,0.24)" />
    <rect x="370" y="236" width="170" height="10" rx="5" fill="rgba(255,255,255,0.18)" />
    <rect x="370" y="258" width="120" height="10" rx="5" fill="rgba(255,255,255,0.16)" />
  `
}

function renderFeatures(accent, variant) {
  const focusWidths = ['172', '196', '182'][variant]

  return `
    <rect x="50" y="78" width="258" height="118" rx="26" fill="url(#accentGlow)" />
    <rect x="326" y="78" width="264" height="118" rx="26" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <rect x="50" y="214" width="170" height="132" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <rect x="238" y="214" width="170" height="132" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <rect x="426" y="214" width="164" height="132" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
    <rect x="74" y="110" width="${focusWidths}" height="14" rx="7" fill="rgba(255,255,255,0.93)" />
    <rect x="74" y="138" width="150" height="10" rx="5" fill="rgba(255,255,255,0.22)" />
    ${[74, 262, 450]
      .map(
        (x) => `
      <circle cx="${x}" cy="252" r="18" fill="${accent}" opacity="0.9" />
      <rect x="${x + 32}" y="244" width="84" height="10" rx="5" fill="rgba(255,255,255,0.26)" />
      <rect x="${x + 32}" y="264" width="104" height="10" rx="5" fill="rgba(255,255,255,0.16)" />
    `,
      )
      .join('')}
  `
}

function renderFaq(accent, variant) {
  const activeWidth = ['498', '472', '514'][variant]

  return `
    <rect x="54" y="82" width="532" height="62" rx="22" fill="rgba(66,99,255,0.14)" stroke="${accent}" />
    <rect x="54" y="160" width="532" height="62" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" />
    <rect x="54" y="238" width="532" height="62" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" />
    <rect x="54" y="316" width="532" height="62" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" />
    <rect x="82" y="106" width="${activeWidth}" height="12" rx="6" fill="rgba(255,255,255,0.95)" />
    ${[184, 262, 340]
      .map(
        (y) => `
      <rect x="82" y="${y}" width="418" height="12" rx="6" fill="rgba(255,255,255,0.26)" />
    `,
      )
      .join('')}
    <circle cx="548" cy="113" r="12" fill="rgba(255,255,255,0.22)" />
    <circle cx="548" cy="191" r="12" fill="rgba(255,255,255,0.14)" />
    <circle cx="548" cy="269" r="12" fill="rgba(255,255,255,0.14)" />
    <circle cx="548" cy="347" r="12" fill="rgba(255,255,255,0.14)" />
  `
}

function renderFooter(accent, variant) {
  const topWidth = ['228', '198', '214'][variant]

  return `
    <rect x="44" y="74" width="552" height="132" rx="28" fill="url(#accentGlow)" opacity="0.92" />
    <rect x="44" y="228" width="552" height="150" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" />
    <rect x="70" y="108" width="${topWidth}" height="16" rx="8" fill="rgba(255,255,255,0.95)" />
    <rect x="70" y="138" width="164" height="10" rx="5" fill="rgba(255,255,255,0.24)" />
    <rect x="70" y="160" width="138" height="10" rx="5" fill="rgba(255,255,255,0.18)" />
    <rect x="456" y="118" width="114" height="44" rx="22" fill="rgba(9,9,11,0.66)" />
    ${[80, 220, 360]
      .map(
        (x) => `
      <rect x="${x}" y="256" width="80" height="10" rx="5" fill="rgba(255,255,255,0.30)" />
      <rect x="${x}" y="286" width="96" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
      <rect x="${x}" y="308" width="82" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
      <rect x="${x}" y="330" width="74" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
    `,
      )
      .join('')}
  `
}

const renderers = {
  hero: renderHero,
  cta: renderCta,
  pricing: renderPricing,
  testimonials: renderTestimonials,
  features: renderFeatures,
  faq: renderFaq,
  footer: renderFooter,
}

function buildSvg(category, title, variant) {
  const accent = accentSets[category][variant]
  const layout = renderers[category](accent, variant)
  const safeTitle = escapeXml(title)
  const safeCategory = escapeXml(category.toUpperCase())

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e1f27" />
          <stop offset="100%" stop-color="#121217" />
        </linearGradient>
        <linearGradient id="accentGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="rgba(118,138,255,0.20)" />
        </linearGradient>
        <radialGradient id="orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(78,105,255,0.75)" />
          <stop offset="100%" stop-color="rgba(78,105,255,0)" />
        </radialGradient>
        <filter id="blurGlow">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>
      <rect width="640" height="480" fill="#111114" />
      <g filter="url(#blurGlow)" opacity="0.7">
        <circle cx="540" cy="94" r="92" fill="url(#orb)" />
        <circle cx="120" cy="412" r="78" fill="url(#orb)" opacity="0.35" />
      </g>
      <rect x="20" y="20" width="600" height="440" rx="34" fill="url(#panel)" stroke="rgba(255,255,255,0.06)" />
      <path d="M58 42h102" stroke="rgba(255,255,255,0.08)" stroke-width="2" stroke-linecap="round" />
      <path d="M488 42h94" stroke="rgba(255,255,255,0.08)" stroke-width="2" stroke-linecap="round" />
      ${layout}
      <rect x="32" y="394" width="576" height="54" rx="20" fill="rgba(9,9,11,0.56)" stroke="rgba(255,255,255,0.08)" />
      <text x="52" y="417" fill="rgba(255,255,255,0.98)" font-size="19" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">${safeTitle}</text>
      <text x="52" y="437" fill="rgba(255,255,255,0.56)" font-size="11" font-weight="700" letter-spacing="2" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">${safeCategory}</text>
    </svg>
  `
}

await mkdir(outputDir, { recursive: true })

for (const [index, [category, id, title]] of items.entries()) {
  const variant = index % 3
  const svg = buildSvg(category, title, variant)
  const output = path.join(outputDir, `${id}.webp`)

  await sharp(Buffer.from(svg)).resize(640, 480).webp({ quality: 88 }).toFile(output)
}

console.log(`Generated ${items.length} preview images in ${outputDir}`)
