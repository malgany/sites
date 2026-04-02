import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CATALOG_CACHE_KEY } from './catalog/cache'
import { getCatalogContent, refreshCatalogMetadata } from './catalog/repository'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import type { CatalogCardItem } from './types'

vi.mock('./catalog/repository', () => ({
  getCatalogContent: vi.fn(),
  refreshCatalogMetadata: vi.fn(),
}))

vi.mock('./lib/copyTextToClipboard', () => ({
  copyTextToClipboard: vi.fn(),
}))

const mockedRefreshCatalogMetadata = vi.mocked(refreshCatalogMetadata)
const mockedGetCatalogContent = vi.mocked(getCatalogContent)
const mockedCopy = vi.mocked(copyTextToClipboard)
const mockedConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

const catalogItems: CatalogCardItem[] = [
  {
    slug: 'atelie-orbita',
    title: 'Atelie Orbita',
    typeLabel: 'Estudio',
    posterUrl: 'https://example.com/atelie-orbita.webp',
    animatedPreviewUrl: 'https://example.com/atelie-orbita.gif',
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
  mockedRefreshCatalogMetadata.mockResolvedValue(catalogItems)
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  mockedRefreshCatalogMetadata.mockReset()
  mockedGetCatalogContent.mockReset()
  mockedCopy.mockReset()
  mockedConsoleError.mockClear()
  window.localStorage.clear()
})

describe('App', () => {
  it('renders the cached catalog immediately and refreshes metadata in the background', async () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    expect(screen.queryByText('Loading public catalog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Atelie Orbita', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('Refreshing catalog.')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockedRefreshCatalogMetadata).toHaveBeenCalledTimes(1)
    })
  })

  it('persists the refreshed catalog in local storage', async () => {
    render(<App />)

    await waitFor(() => {
      expect(mockedRefreshCatalogMetadata).toHaveBeenCalledTimes(1)
    })

    expect(window.localStorage.getItem(CATALOG_CACHE_KEY)).toBe(
      JSON.stringify(catalogItems),
    )
  })

  it('filters cards by title and type label', async () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

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

  it('shows All as the default selected type filter', () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Estudio' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('filters cards by selected types and combines multiple types', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Estudio' }))

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(1)
    })

    expect(
      screen.getByRole('heading', { name: 'Atelie Orbita', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    await user.click(screen.getByRole('button', { name: 'Calculator' }))

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(2)
    })

    expect(
      screen.getByRole('heading', { name: 'Price Calculator', level: 2 }),
    ).toBeInTheDocument()
  })

  it('clicking All clears both the selected types and the text search', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    const searchbox = screen.getByRole('searchbox', {
      name: 'Search prompts or types',
    })

    fireEvent.change(searchbox, {
      target: { value: 'automation' },
    })
    await user.click(screen.getByRole('button', { name: 'Calculator' }))

    await waitFor(() => {
      expect(screen.queryAllByRole('article')).toHaveLength(0)
    })

    await user.click(screen.getByRole('button', { name: 'All' }))

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(3)
    })

    expect(searchbox).toHaveValue('')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Calculator' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows the empty state when the query has no matches', async () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

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
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

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

    expect(mockedGetCatalogContent).toHaveBeenCalledWith('atelie-orbita')
    expect(mockedCopy).toHaveBeenCalledWith('# Raw markdown prompt')
    expect(button).toHaveTextContent('Copied')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(button).toHaveTextContent('Copy')
  })

  it('shows an error state when the markdown fetch fails', async () => {
    mockedGetCatalogContent.mockRejectedValue(new Error('boom'))
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

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

  it('keeps the cached catalog available when the metadata refresh fails', async () => {
    mockedRefreshCatalogMetadata.mockRejectedValue(
      new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the public catalog.'),
    )
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Atelie Orbita', level: 2 }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(
          'The catalog could not be refreshed. Showing the last saved version.',
        ),
      ).toBeInTheDocument()
    })

    expect(screen.queryByText('Public catalog unavailable')).not.toBeInTheDocument()
  })

  it('shows the blocking error state when refresh fails without cached data', async () => {
    mockedRefreshCatalogMetadata.mockRejectedValue(
      new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the public catalog.'),
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Public catalog unavailable')).toBeInTheDocument()
    })

    expect(
      screen.getByText(
        'The catalog is temporarily unavailable. Please try again in a moment.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the public catalog.',
      ),
    ).not.toBeInTheDocument()
    expect(mockedConsoleError).toHaveBeenCalled()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
