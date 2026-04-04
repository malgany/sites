import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { signInWithGoogle } from './auth/api'
import { usePremiumAccess } from './auth/usePremiumAccess'
import { CATALOG_CACHE_KEY } from './catalog/cache'
import { getCatalogContent, refreshCatalogMetadata } from './catalog/repository'
import { copyTextToClipboard } from './lib/copyTextToClipboard'
import type { CatalogCardItem, PremiumAccessState } from './types'

vi.mock('./auth/api', () => ({
  signInWithGoogle: vi.fn(),
}))

vi.mock('./auth/usePremiumAccess', () => ({
  usePremiumAccess: vi.fn(),
}))

vi.mock('./catalog/repository', () => ({
  getCatalogContent: vi.fn(),
  refreshCatalogMetadata: vi.fn(),
}))

vi.mock('./lib/copyTextToClipboard', () => ({
  copyTextToClipboard: vi.fn(),
}))

const mockedUsePremiumAccess = vi.mocked(usePremiumAccess)
const mockedSignInWithGoogle = vi.mocked(signInWithGoogle)
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
    requiredPlan: null,
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
    requiredPlan: 'premium',
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
    requiredPlan: null,
  },
]

function mockPremiumAccess(accessState: PremiumAccessState) {
  const signOut = vi.fn().mockResolvedValue(undefined)

  mockedUsePremiumAccess.mockReturnValue({
    accessState,
    errorMessage: null,
    isLoading: false,
    refresh: vi.fn(),
    signOut,
    userEmail: accessState.isAuthenticated ? 'user@example.com' : null,
  })

  return { signOut }
}

beforeEach(() => {
  mockedRefreshCatalogMetadata.mockResolvedValue(catalogItems)
  mockedSignInWithGoogle.mockResolvedValue(undefined)
  mockPremiumAccess({
    isAuthenticated: false,
    status: 'signed_out',
    planCode: null,
  })
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  mockedUsePremiumAccess.mockReset()
  mockedSignInWithGoogle.mockReset()
  mockedRefreshCatalogMetadata.mockReset()
  mockedGetCatalogContent.mockReset()
  mockedCopy.mockReset()
  mockedConsoleError.mockClear()
  window.localStorage.clear()
})

describe('App', () => {
  it('starts Google sign in from the header when the visitor clicks Entrar', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(mockedSignInWithGoogle).toHaveBeenCalledWith('/')
    })
  })

  it('signs out from the header when the authenticated user clicks Sair', async () => {
    const { signOut } = mockPremiumAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /sair/i }))

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1)
    })
  })

  it('renders the cached catalog immediately and refreshes metadata in the background', async () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    expect(screen.queryByText('Carregando catalogo')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Atelie Orbita', level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('Atualizando catalogo.')).toBeInTheDocument()

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

  it('copies the selected markdown and resets the button state', async () => {
    mockedGetCatalogContent.mockResolvedValue('# Raw markdown prompt')
    mockedCopy.mockResolvedValue(true)
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)
    vi.useFakeTimers()

    const button = within(screen.getAllByRole('article')[0]).getByRole('button', {
      name: /copiar/i,
    })

    await act(async () => {
      fireEvent.click(button)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockedGetCatalogContent).toHaveBeenCalledWith('atelie-orbita')
    expect(mockedCopy).toHaveBeenCalledWith('# Raw markdown prompt')
    expect(button).toHaveTextContent('Copiado')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(button).toHaveTextContent('Copiar')
  })

  it('renders premium cards with a pricing link instead of a copy action when access is locked', () => {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    const premiumCard = screen.getByRole('heading', {
      name: 'Nexora Automation',
      level: 2,
    }).closest('[role="article"]')

    expect(premiumCard).not.toBeNull()
    expect(
      within(premiumCard as HTMLElement).getByRole('link', { name: /ver plano premium/i }),
    ).toHaveAttribute(
      'href',
      '/pricing/?from=nexora-hero',
    )
    expect(
      within(premiumCard as HTMLElement).queryByRole('button', { name: /copiar/i }),
    ).not.toBeInTheDocument()
  })

  it('renders the copy action for premium cards when the user has active access', () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'active',
      planCode: 'premium',
    })
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    const premiumCard = screen.getByRole('heading', {
      name: 'Nexora Automation',
      level: 2,
    }).closest('[role="article"]')

    expect(premiumCard).not.toBeNull()
    expect(
      within(premiumCard as HTMLElement).getByRole('button', {
        name: /copiar: nexora automation/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(premiumCard as HTMLElement).queryByRole('link', { name: /ver plano premium/i }),
    ).not.toBeInTheDocument()
  })

  it('shows an error state when the markdown fetch fails', async () => {
    mockedGetCatalogContent.mockRejectedValue(new Error('boom'))
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    const button = within(screen.getAllByRole('article')[2]).getByRole('button', {
      name: /copiar/i,
    })

    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveTextContent('Falha ao copiar')
      expect(screen.getAllByText('Falha ao copiar')).toHaveLength(2)
    })
  })

  it('keeps the cached catalog available when the metadata refresh fails', async () => {
    mockedRefreshCatalogMetadata.mockRejectedValue(
      new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'),
    )
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalogItems))

    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Atelie Orbita', level: 2 }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText(
          'Nao foi possivel atualizar o catalogo. Exibindo a ultima versao salva.',
        ),
      ).toBeInTheDocument()
    })

    expect(screen.queryByText('Catalogo publico indisponivel')).not.toBeInTheDocument()
  })

  it('shows the blocking error state when refresh fails without cached data', async () => {
    mockedRefreshCatalogMetadata.mockRejectedValue(
      new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'),
    )

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Catalogo indisponivel')).toBeInTheDocument()
    })

    expect(
      screen.getByText(
        'O catalogo esta temporariamente indisponivel. Tente novamente em instantes.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'),
    ).not.toBeInTheDocument()
    expect(mockedConsoleError).toHaveBeenCalled()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
