export type CategoryId =
  | 'all'
  | 'hero'
  | 'cta'
  | 'pricing'
  | 'testimonials'
  | 'features'
  | 'faq'
  | 'footer'

export type ComponentCategory = Exclude<CategoryId, 'all'>

export type Badge = 'New' | 'Popular' | null

export type ComponentItem = {
  id: string
  title: string
  brief: string
  category: ComponentCategory
  image: string
  badge: Badge
  prompt: string
}
