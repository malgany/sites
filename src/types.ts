export type CatalogVisibility = 'public' | 'private'

export type CatalogPreviewKind = 'image' | 'video'

export type CatalogManifestReferenceLookup = {
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
  previewUrl: string | null
  previewKind: CatalogPreviewKind
  isPublic: boolean
}

export type CatalogCardLayout = 'compact' | 'feature'

export type CatalogCopyState = 'idle' | 'pending' | 'copied' | 'error'
