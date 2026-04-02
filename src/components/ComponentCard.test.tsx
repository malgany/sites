import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComponentCard } from './ComponentCard'
import type { CatalogCardItem } from '../types'

const baseItem: CatalogCardItem = {
  slug: 'aethera-hero',
  title: 'Aethera Studio',
  typeLabel: 'Studio',
  posterUrl: 'https://example.com/aethera.webp',
  animatedPreviewUrl: null,
  animatedPreviewKind: null,
  previewWidth: 1200,
  previewHeight: 900,
  isPublic: true,
}

describe('ComponentCard', () => {
  it('uses the shared feature media sizing for portrait previews', () => {
    render(
      <ComponentCard
        item={{
          ...baseItem,
          previewWidth: 455,
          previewHeight: 800,
        }}
        copyState="idle"
        onCopy={vi.fn()}
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
        item={baseItem}
        copyState="idle"
        onCopy={vi.fn()}
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
        item={baseItem}
        copyState="idle"
        onCopy={vi.fn()}
      />,
    )

    expect(screen.getByAltText('Aethera Studio preview')).toHaveAttribute(
      'draggable',
      'false',
    )
  })
})
