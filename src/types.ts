export type CatalogVisibility = 'public' | 'private'

export type CatalogPreviewKind = 'image' | 'video'

export type CatalogManifestReferenceLookup = {
  motionSitesSlug?: string
  motionSitesTitle?: string
  preferredSource?: 'lovable_templates' | 'motion_videos'
  keywords?: string[]
}

export type CatalogManifestItem = {
  slug: string
  title: string
  typeLabel: string
  sortOrder: number
  visibility: CatalogVisibility
  referenceLookup: CatalogManifestReferenceLookup
}

export type CatalogCardItem = {
  slug: string
  title: string
  typeLabel: string
  keywords?: readonly string[]
  posterUrl: string | null
  animatedPreviewUrl: string | null
  animatedPreviewKind: CatalogPreviewKind | null
  previewWidth: number | null
  previewHeight: number | null
  isPublic: boolean
  requiredPlan: string | null
}

export type CatalogCardLayout = 'compact' | 'feature'

export type CatalogCopyState = 'idle' | 'pending' | 'copied' | 'error'

export type PremiumPlanCode = 'premium'

export type PremiumAccessStatus = 'signed_out' | 'pending' | 'active' | 'revoked'

export type PremiumAccessState = {
  isAuthenticated: boolean
  status: PremiumAccessStatus
  planCode: PremiumPlanCode | null
}
