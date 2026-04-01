import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  getCatalogContent,
  getStaticCatalog,
  refreshCatalogMetadata,
} from './catalog/repository'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import type { CatalogCardItem } from './types'

vi.mock('./catalog/repository', () => ({
  getCatalogContent: vi.fn(),
  getStaticCatalog: vi.fn(),
  refreshCatalogMetadata: vi.fn(),
}))

vi.mock('./lib/copyTextToClipboard', () => ({
  copyTextToClipboard: vi.fn(),
}))

const mockedGetStaticCatalog = vi.mocked(getStaticCatalog)
const mockedRefreshCatalogMetadata = vi.mocked(refreshCatalogMetadata)
const mockedGetCatalogContent = vi.mocked(getCatalogContent)
const mockedCopy = vi.mocked(copyTextToClipboard)

const catalogItems: CatalogCardItem[] = [
  {
    slug: 'aethera-hero',
    title: 'Aethera Studio',
    typeLabel: 'Studio',
    posterUrl: 'https://example.com/aethera.webp',
    animatedPreviewUrl: 'https://example.com/aethera.gif',
    animatedPreviewKind: 'image',
    previewWidth: 1200,
    previewHeight: 1600,
    isPublic: true,
  },
  {
    slug: 'nexora-hero',
    title: 'Nexora Automation',
    typeLabel: 'Automation',
    posterUrl: 'https://example.com/nexora.webp',
    animatedPreviewUrl: 'https://example.com/nexora.mp4',
    animatedPreviewKind: 'video',
    previewWidth: 1280,
    previewHeight: 720,
    isPublic: true,
  },
  {
    slug: 'price-calculator',
    title: 'Price Calculator',
    typeLabel: 'Calculator',
    posterUrl: null,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
    previewWidth: null,
    previewHeight: null,
    isPublic: true,
  },
]

beforeEach(() => {
  mockedGetStaticCatalog.mockReturnValue(catalogItems)
  mockedRefreshCatalogMetadata.mockResolvedValue(catalogItems)
})

afterEach(() => {
  vi.useRealTimers()
  mockedGetStaticCatalog.mockReset()
  mockedRefreshCatalogMetadata.mockReset()
  mockedGetCatalogContent.mockReset()
  mockedCopy.mockReset()
})

describe('App', () => {
  it('renders the local catalog immediately and refreshes metadata in the background', async () => {
    render(<App />)

    expect(screen.queryByText('Loading public catalog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Aethera Studio', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('Refreshing Supabase metadata.')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedRefreshCatalogMetadata).toHaveBeenCalledTimes(1)
    })
  })

  it('filters cards by title and type label', async () => {
    render(<App />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search prompts or types' }), {
      target: { value: 'automation' },
    })

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(1)
    })

    expect(
      screen.getByRole('heading', { name: 'Nexora Automation', level: 2 }),
    ).toBeInTheDocument()
  })

  it('shows the empty state when the query has no matches', async () => {
    render(<App />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search prompts or types' }), {
      target: { value: 'not-a-real-match' },
    })

    await waitFor(() => {
      expect(screen.queryAllByRole('article')).toHaveLength(0)
    })

    expect(screen.getByText('No prompts found')).toBeInTheDocument()
  })

  it('copies the selected markdown and resets the button state', async () => {
    mockedGetCatalogContent.mockResolvedValue('# Raw markdown prompt')
    mockedCopy.mockResolvedValue(true)

    render(<App />)
    vi.useFakeTimers()

    const button = within(screen.getAllByRole('article')[0]).getByRole('button', {
      name: /copy/i,
    })

    await act(async () => {
      fireEvent.click(button)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockedGetCatalogContent).toHaveBeenCalledWith('aethera-hero')
    expect(mockedCopy).toHaveBeenCalledWith('# Raw markdown prompt')
    expect(button).toHaveTextContent('Copied')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(button).toHaveTextContent('Copy')
  })

  it('shows an error state when the markdown fetch fails', async () => {
    mockedGetCatalogContent.mockRejectedValue(new Error('boom'))

    render(<App />)

    const button = within(screen.getAllByRole('article')[1]).getByRole('button', {
      name: /copy/i,
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveTextContent('Copy failed')
      expect(screen.getAllByText('Copy failed')).toHaveLength(2)
    })
  })

  it('keeps the local catalog available when the metadata refresh fails', async () => {
    mockedRefreshCatalogMetadata.mockRejectedValue(
      new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the public catalog.'),
    )

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Aethera Studio', level: 2 }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(
          'Background metadata sync is unavailable. Browsing still uses the local catalog.',
        ),
      ).toBeInTheDocument()
    })

    expect(screen.queryByText('Public catalog unavailable')).not.toBeInTheDocument()
  })
})
