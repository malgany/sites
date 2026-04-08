import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CatalogCardItem } from '../types'
import { ComponentCard } from './ComponentCard'

const baseItem: CatalogCardItem = {
  slug: 'atelie-orbita',
  title: 'Atelie Orbita',
  typeLabel: 'Estudio',
  posterUrl: 'https://example.com/atelie-orbita.webp',
  animatedPreviewUrl: null,
  animatedPreviewKind: null,
  previewWidth: 1200,
  previewHeight: 900,
  isPublic: true,
  requiredPlan: null,
}

describe('ComponentCard', () => {
  it('uses the shared feature media sizing for portrait previews', () => {
    render(
      <ComponentCard
        hasPremiumAccess={false}
        item={{
          ...baseItem,
          previewWidth: 455,
          previewHeight: 800,
        }}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=atelie-orbita"
      />,
    )

    const article = screen.getByRole('article')
    const media = article.firstElementChild
    const body = article.lastElementChild

    expect(article).toHaveClass('catalog-card')
    expect(media).toHaveClass('catalog-card__media--feature')
    expect(body).toHaveClass('catalog-card__body')
  })

  it('keeps landscape previews on the compact 4:3 media frame', () => {
    render(
      <ComponentCard
        hasPremiumAccess={false}
        item={baseItem}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=atelie-orbita"
      />,
    )

    const article = screen.getByRole('article')
    const mediaClassName = article.firstElementChild?.className ?? ''

    expect(mediaClassName).toContain('aspect-[4/3]')
    expect(mediaClassName).not.toContain('catalog-card__media--feature')
  })

  it('disables image dragging for preview media', () => {
    render(
      <ComponentCard
        hasPremiumAccess={false}
        item={baseItem}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=atelie-orbita"
      />,
    )

    expect(screen.getByAltText('Atelie Orbita preview')).toHaveAttribute(
      'draggable',
      'false',
    )
  })

  it('renders a premium pricing link when the card requires a plan and access is locked', () => {
    render(
      <ComponentCard
        hasPremiumAccess={false}
        item={{
          ...baseItem,
          requiredPlan: 'premium',
        }}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=atelie-orbita"
      />,
    )

    expect(screen.getByRole('link', { name: /ver plano premium/i })).toHaveAttribute(
      'href',
      '/pricing/?from=atelie-orbita',
    )
    expect(screen.queryByRole('button', { name: /copiar/i })).not.toBeInTheDocument()
  })

  it('renders the copy button for premium cards when the user already has access', () => {
    render(
      <ComponentCard
        hasPremiumAccess
        item={{
          ...baseItem,
          requiredPlan: 'premium',
        }}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=atelie-orbita"
      />,
    )

    expect(screen.getByRole('button', { name: /copiar: atelie orbita/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ver plano premium/i })).not.toBeInTheDocument()
  })

  it('renders the site preview link when the card slug has a configured preview url', () => {
    render(
      <ComponentCard
        hasPremiumAccess={false}
        item={{
          ...baseItem,
          slug: 'orbis-nft-landing',
          title: 'Orbis NFT',
        }}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=orbis-nft-landing"
      />,
    )

    const previewLink = screen.getByRole('link', { name: /ver preview do site: orbis nft/i })

    expect(previewLink).toHaveAttribute(
      'href',
      'https://orbit-glass-showcase.lovable.app/',
    )
    expect(previewLink).toHaveAttribute('target', '_blank')
    expect(previewLink.getAttribute('rel')).toContain('noopener')
    expect(previewLink.getAttribute('rel')).toContain('noreferrer')
  })

  it('does not render the site preview link when the card slug has no configured preview', () => {
    render(
      <ComponentCard
        hasPremiumAccess={false}
        item={baseItem}
        copyState="idle"
        onCopy={vi.fn()}
        pricingHref="/pricing/?from=atelie-orbita"
      />,
    )

    expect(screen.queryByRole('link', { name: /ver preview do site/i })).not.toBeInTheDocument()
  })
})
