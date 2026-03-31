import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getCatalogContent, listPublicCatalog } from './catalog/repository'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import type { CatalogCardItem } from './types'

vi.mock('./catalog/repository', () => ({
  getCatalogContent: vi.fn(),
  listPublicCatalog: vi.fn(),
}))

vi.mock('./lib/copyTextToClipboard', () => ({
  copyTextToClipboard: vi.fn(),
}))

const mockedListPublicCatalog = vi.mocked(listPublicCatalog)
const mockedGetCatalogContent = vi.mocked(getCatalogContent)
const mockedCopy = vi.mocked(copyTextToClipboard)

const catalogItems: CatalogCardItem[] = [
  {
    slug: 'aethera-hero',
    title: 'Aethera Studio',
    typeLabel: 'Studio',
    previewUrl: 'https://example.com/aethera.webp',
    previewKind: 'image',
    isPublic: true,
  },
  {
    slug: 'nexora-hero',
    title: 'Nexora Automation',
    typeLabel: 'Automation',
    previewUrl: 'https://example.com/nexora.mp4',
    previewKind: 'video',
    isPublic: true,
  },
  {
    slug: 'price-calculator',
    title: 'Price Calculator',
    typeLabel: 'Calculator',
    previewUrl: null,
    previewKind: 'image',
    isPublic: true,
  },
]

afterEach(() => {
  vi.useRealTimers()
  mockedListPublicCatalog.mockReset()
  mockedGetCatalogContent.mockReset()
  mockedCopy.mockReset()
})

describe('App', () => {
  it('renders the public catalog after the list request resolves', async () => {
    mockedListPublicCatalog.mockResolvedValue(catalogItems)

    render(<App />)

    expect(screen.getByText('Loading public catalog')).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', { name: 'Prompt Archive' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it('filters cards by title and type label', async () => {
    mockedListPublicCatalog.mockResolvedValue(catalogItems)

    render(<App />)

    await screen.findByRole('heading', { name: 'Aethera Studio', level: 2 })

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
    mockedListPublicCatalog.mockResolvedValue(catalogItems)

    render(<App />)
    await screen.findByRole('heading', { name: 'Aethera Studio', level: 2 })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search prompts or types' }), {
      target: { value: 'not-a-real-match' },
    })

    await waitFor(() => {
      expect(screen.queryAllByRole('article')).toHaveLength(0)
    })

    expect(screen.getByText('No prompts found')).toBeInTheDocument()
  })

  it('copies the selected markdown and resets the button state', async () => {
    mockedListPublicCatalog.mockResolvedValue(catalogItems)
    mockedGetCatalogContent.mockResolvedValue('# Raw markdown prompt')
    mockedCopy.mockResolvedValue(true)

    render(<App />)
    await screen.findByRole('heading', { name: 'Aethera Studio', level: 2 })
    vi.useFakeTimers()

    const button = within(screen.getAllByRole('article')[0]).getByRole('button', {
      name: /copy markdown/i,
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

    expect(button).toHaveTextContent('Copy markdown')
  })

  it('shows an error state when the markdown fetch fails', async () => {
    mockedListPublicCatalog.mockResolvedValue(catalogItems)
    mockedGetCatalogContent.mockRejectedValue(new Error('boom'))

    render(<App />)
    await screen.findByRole('heading', { name: 'Aethera Studio', level: 2 })

    const button = within(screen.getAllByRole('article')[1]).getByRole('button', {
      name: /copy markdown/i,
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveTextContent('Copy failed')
      expect(screen.getAllByText('Copy failed')).toHaveLength(2)
    })
  })

  it('shows the catalog error panel when Supabase metadata cannot load', async () => {
    mockedListPublicCatalog.mockRejectedValue(
      new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the public catalog.'),
    )

    render(<App />)

    expect(await screen.findByText('Public catalog unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for the public catalog.',
      ),
    ).toBeInTheDocument()
  })
})
