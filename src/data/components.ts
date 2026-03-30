import type { Badge, CategoryId, ComponentCategory, ComponentItem } from '../types'

type CategoryOption = {
  id: CategoryId
  label: string
}

type PromptSeed = {
  id: string
  title: string
  badge: Badge
  brief: string
  requirements: string[]
}

const categoryMeta: Record<
  ComponentCategory,
  { label: string; intro: string; emphasis: string }
> = {
  hero: {
    label: 'Hero',
    intro: 'Create a polished hero section for a product landing page.',
    emphasis: 'Make the above-the-fold composition feel premium and conversion-focused.',
  },
  cta: {
    label: 'CTA',
    intro: 'Create a focused call-to-action section that converts quickly.',
    emphasis: 'Keep the layout compact, clear, and action-oriented.',
  },
  pricing: {
    label: 'Pricing',
    intro: 'Create a pricing section for a modern SaaS or service website.',
    emphasis: 'Balance clarity, trust, and visual hierarchy across all tiers.',
  },
  testimonials: {
    label: 'Testimonials',
    intro: 'Create a testimonial section that builds trust and social proof.',
    emphasis: 'Make the quotes easy to scan while keeping the section visually rich.',
  },
  features: {
    label: 'Features',
    intro: 'Create a features section that explains product value quickly.',
    emphasis: 'Use strong grouping and contrast so the benefits are immediately scannable.',
  },
  faq: {
    label: 'FAQ',
    intro: 'Create an FAQ section for a product or service landing page.',
    emphasis: 'Prioritize clarity, spacing, and easy expansion behavior.',
  },
  footer: {
    label: 'Footer',
    intro: 'Create a footer section that closes the page cleanly.',
    emphasis: 'Make the footer feel structured, credible, and easy to navigate.',
  },
}

const categorySeeds: Record<ComponentCategory, readonly PromptSeed[]> = {
  hero: [
    {
      id: 'ai-product-hero',
      title: 'AI Product Hero',
      badge: 'Popular',
      brief:
        'Show a bold AI product headline, compact supporting copy, a primary CTA, a secondary CTA, and a layered product preview.',
      requirements: [
        'Use a dark neutral background with a vivid blue accent glow.',
        'Keep the heading uppercase and visually dominant.',
        'Add a small trust strip below the CTA row.',
      ],
    },
    {
      id: 'agency-spotlight-hero',
      title: 'Agency Spotlight Hero',
      badge: null,
      brief:
        'Present a creative agency hero with a split layout, oversized typography, service highlights, and one standout CTA.',
      requirements: [
        'Use an editorial grid with asymmetry instead of a centered layout.',
        'Include a short list of three service bullets.',
        'Make the right side feel like a polished studio preview.',
      ],
    },
    {
      id: 'gradient-portfolio-hero',
      title: 'Gradient Portfolio Hero',
      badge: 'New',
      brief:
        'Build a portfolio hero with a dramatic gradient backdrop, large personal headline, stats, and a featured project teaser.',
      requirements: [
        'Use layered gradients and soft glass panels.',
        'Keep the copy concise and premium.',
        'Add a subtle scroll cue or availability tag.',
      ],
    },
  ],
  cta: [
    {
      id: 'split-cta-banner',
      title: 'Split CTA Banner',
      badge: 'Popular',
      brief:
        'Create a horizontal CTA banner with strong headline copy, one supporting sentence, and two actions side by side.',
      requirements: [
        'Use a split layout with one text block and one compact stats or badge panel.',
        'Keep the section short enough to fit between other landing page blocks.',
        'Use a bold rounded container with a blue highlight.',
      ],
    },
    {
      id: 'minimal-signup-cta',
      title: 'Minimal Signup CTA',
      badge: null,
      brief:
        'Create a minimal signup section with concise copy, an email input, and a high-contrast submit button.',
      requirements: [
        'Keep the layout minimal and centered.',
        'Use a clean form row with clear spacing and states.',
        'Add a tiny privacy note under the form.',
      ],
    },
    {
      id: 'dark-download-cta',
      title: 'Dark Download CTA',
      badge: 'New',
      brief:
        'Create a dark CTA promoting a downloadable resource with one strong button and a short list of what is included.',
      requirements: [
        'Use stacked content with a heavy heading and compact bullet list.',
        'Keep the card edges soft and premium.',
        'Use subtle blue accent lighting, not a bright gradient wash.',
      ],
    },
  ],
  pricing: [
    {
      id: 'startup-pricing-grid',
      title: 'Startup Pricing Grid',
      badge: 'Popular',
      brief:
        'Create a three-tier SaaS pricing section with monthly billing, plan highlights, feature lists, and a featured middle plan.',
      requirements: [
        'Make the middle plan visually dominant.',
        'Use concise plan copy and clear CTA buttons.',
        'Include a small section note above the pricing cards.',
      ],
    },
    {
      id: 'agency-retainer-pricing',
      title: 'Agency Retainer Pricing',
      badge: null,
      brief:
        'Create pricing for an agency retainer page with three service levels, deliverables, response times, and CTA buttons.',
      requirements: [
        'Keep the tone premium and service-oriented instead of product-oriented.',
        'Use concise checklists under each plan.',
        'Show one custom enterprise option as a secondary row or note.',
      ],
    },
    {
      id: 'usage-pricing-table',
      title: 'Usage Pricing Table',
      badge: 'New',
      brief:
        'Create a usage-based pricing section with plans, metered details, included credits, and comparison cues.',
      requirements: [
        'Make the numeric details readable at a glance.',
        'Use a small billing note and one trust cue below the cards.',
        'Keep the visual style modern, dark, and sharp.',
      ],
    },
  ],
  testimonials: [
    {
      id: 'founder-quote-stack',
      title: 'Founder Quote Stack',
      badge: 'Popular',
      brief:
        'Create a testimonials section with stacked founder quotes, company logos, role labels, and short credibility metrics.',
      requirements: [
        'Use a clean card rhythm with strong contrast.',
        'Show one quote larger than the others.',
        'Keep the section balanced between text and supporting brand marks.',
      ],
    },
    {
      id: 'video-testimonial-strip',
      title: 'Video Testimonial Strip',
      badge: null,
      brief:
        'Create a testimonial strip with video-style preview cards, short quotes, speaker names, and a compact trust headline.',
      requirements: [
        'Use thumbnail placeholders with clear play affordances.',
        'Make the strip feel dense but readable.',
        'Add subtle rating or review metadata.',
      ],
    },
    {
      id: 'logo-review-wall',
      title: 'Logo Review Wall',
      badge: 'New',
      brief:
        'Create a social proof section combining brand logos, customer review snippets, star ratings, and one summary stat block.',
      requirements: [
        'Use a wall-like composition with varied card sizes.',
        'Keep the typography compact and easy to scan.',
        'Avoid bright backgrounds; stay within a dark premium palette.',
      ],
    },
  ],
  features: [
    {
      id: 'feature-bento-grid',
      title: 'Feature Bento Grid',
      badge: 'Popular',
      brief:
        'Create a bento-style feature grid with mixed card sizes, icons, short descriptions, and one featured capability.',
      requirements: [
        'Use a strong visual hierarchy with one oversized card.',
        'Keep descriptions to one or two lines.',
        'Use blue accent details sparingly.',
      ],
    },
    {
      id: 'product-timeline-features',
      title: 'Product Timeline Features',
      badge: null,
      brief:
        'Create a product features section organized as a timeline or step-by-step narrative with short explanations.',
      requirements: [
        'Show clear progression from one feature to the next.',
        'Use connector lines or subtle motion cues.',
        'Keep the layout elegant on both desktop and mobile.',
      ],
    },
    {
      id: 'comparison-feature-grid',
      title: 'Comparison Feature Grid',
      badge: 'New',
      brief:
        'Create a comparison-style features section with multiple columns, capability labels, and visual yes-no indicators.',
      requirements: [
        'Keep the grid highly legible and structured.',
        'Use strong contrast between headers and cell content.',
        'Include a short headline and compact intro above the table.',
      ],
    },
  ],
  faq: [
    {
      id: 'accordion-faq-block',
      title: 'Accordion FAQ Block',
      badge: 'Popular',
      brief:
        'Create a polished FAQ section with an accordion list, short answers, and a small support CTA beside or below it.',
      requirements: [
        'Use rounded panels with clear open and closed states.',
        'Keep the spacing generous and calm.',
        'Add one small support link or contact action.',
      ],
    },
    {
      id: 'two-column-faq',
      title: 'Two-Column FAQ',
      badge: null,
      brief:
        'Create a two-column FAQ layout with grouped questions, brief answers, and a compact category heading for each column.',
      requirements: [
        'Use clear column separation without looking crowded.',
        'Keep answers concise and readable.',
        'Support clean collapse into one column on smaller screens.',
      ],
    },
    {
      id: 'support-faq-panel',
      title: 'Support FAQ Panel',
      badge: 'New',
      brief:
        'Create an FAQ panel paired with a support card that shows contact options, response time, and a knowledge base link.',
      requirements: [
        'Make the support card distinct but visually integrated.',
        'Use compact metadata and subtle badges.',
        'Keep the overall section dark and premium.',
      ],
    },
  ],
  footer: [
    {
      id: 'newsletter-footer',
      title: 'Newsletter Footer',
      badge: 'Popular',
      brief:
        'Create a footer with a newsletter signup, navigation links, social links, and a compact legal row.',
      requirements: [
        'Place the signup block as the dominant element.',
        'Use tidy columns and strong spacing.',
        'Keep the footer useful without feeling oversized.',
      ],
    },
    {
      id: 'multi-column-footer',
      title: 'Multi-Column Footer',
      badge: null,
      brief:
        'Create a structured footer with multiple navigation columns, a short brand statement, and small social actions.',
      requirements: [
        'Use four balanced columns on desktop.',
        'Keep link hierarchy obvious and scan-friendly.',
        'Add a restrained divider and copyright row.',
      ],
    },
    {
      id: 'minimal-legal-footer',
      title: 'Minimal Legal Footer',
      badge: 'New',
      brief:
        'Create a compact legal footer with brand mark, privacy and terms links, status copy, and one small contact action.',
      requirements: [
        'Use a low-profile layout designed for dense landing pages.',
        'Keep everything compact but still readable.',
        'Maintain a refined dark aesthetic with subtle borders.',
      ],
    },
  ],
}

function buildPrompt(
  category: ComponentCategory,
  title: string,
  brief: string,
  requirements: readonly string[],
): string {
  const meta = categoryMeta[category]

  return [
    `Build a "${title}" ${meta.label.toLowerCase()} section in React + Tailwind CSS.`,
    '',
    meta.intro,
    brief,
    meta.emphasis,
    '',
    'Requirements:',
    '- Use semantic HTML and keep the component accessible.',
    '- Match a premium MotionSites-inspired style: dark neutral surfaces, near-white text, muted gray secondary text, saturated blue accents, rounded corners, dense but readable spacing.',
    '- Make the component responsive for desktop, tablet, and mobile.',
    '- Keep the implementation self-contained and production-ready.',
    ...requirements.map((requirement) => `- ${requirement}`),
    '- Return JSX markup plus the Tailwind classes needed for the final result.',
  ].join('\n')
}

export const categoryOptions: readonly CategoryOption[] = [
  { id: 'all', label: 'All' },
  { id: 'hero', label: categoryMeta.hero.label },
  { id: 'cta', label: categoryMeta.cta.label },
  { id: 'pricing', label: categoryMeta.pricing.label },
  { id: 'testimonials', label: categoryMeta.testimonials.label },
  { id: 'features', label: categoryMeta.features.label },
  { id: 'faq', label: categoryMeta.faq.label },
  { id: 'footer', label: categoryMeta.footer.label },
] as const

export const categoryLabels: Record<ComponentCategory, string> = {
  hero: categoryMeta.hero.label,
  cta: categoryMeta.cta.label,
  pricing: categoryMeta.pricing.label,
  testimonials: categoryMeta.testimonials.label,
  features: categoryMeta.features.label,
  faq: categoryMeta.faq.label,
  footer: categoryMeta.footer.label,
}

export const componentItems: readonly ComponentItem[] = (
  Object.entries(categorySeeds) as [ComponentCategory, readonly PromptSeed[]][]
).flatMap(([category, items]) =>
  items.map((item) => ({
    id: item.id,
    title: item.title,
    brief: item.brief,
    category,
    image: `/previews/${item.id}.webp`,
    badge: item.badge,
    prompt: buildPrompt(category, item.title, item.brief, item.requirements),
  })),
)
