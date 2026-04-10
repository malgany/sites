import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPremiumCheckoutSession, signInWithGoogle } from './auth/api'
import { usePremiumAccess } from './auth/usePremiumAccess'
import { refreshCatalogMetadata } from './catalog/repository'
import { assignBrowserLocation } from './lib/browserNavigation'
import { trackMetaEvent } from './lib/metaPixel'
import { PricingPage } from './PricingPage'
import type { CatalogCardItem, PremiumAccessState } from './types'

vi.mock('./auth/api', () => ({
  createPremiumCheckoutSession: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

vi.mock('./auth/usePremiumAccess', () => ({
  usePremiumAccess: vi.fn(),
}))

vi.mock('./catalog/repository', () => ({
  refreshCatalogMetadata: vi.fn(),
}))

vi.mock('./lib/browserNavigation', () => ({
  assignBrowserLocation: vi.fn(),
}))

vi.mock('./lib/metaPixel', () => ({
  trackMetaEvent: vi.fn(),
}))

const mockedCreatePremiumCheckoutSession = vi.mocked(createPremiumCheckoutSession)
const mockedSignInWithGoogle = vi.mocked(signInWithGoogle)
const mockedRefreshCatalogMetadata = vi.mocked(refreshCatalogMetadata)
const mockedTrackMetaEvent = vi.mocked(trackMetaEvent)
const mockedUsePremiumAccess = vi.mocked(usePremiumAccess)
const mockedAssignBrowserLocation = vi.mocked(assignBrowserLocation)

const catalogItems: CatalogCardItem[] = [
  {
    slug: 'free-1',
    title: 'Free 1',
    typeLabel: 'Hero',
    posterUrl: null,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
    previewWidth: null,
    previewHeight: null,
    isPublic: true,
    requiredPlan: null,
  },
  {
    slug: 'free-2',
    title: 'Free 2',
    typeLabel: 'Pricing',
    posterUrl: null,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
    previewWidth: null,
    previewHeight: null,
    isPublic: true,
    requiredPlan: null,
  },
  {
    slug: 'premium-1',
    title: 'Premium 1',
    typeLabel: 'CTA',
    posterUrl: null,
    animatedPreviewUrl: null,
    animatedPreviewKind: null,
    previewWidth: null,
    previewHeight: null,
    isPublic: true,
    requiredPlan: 'premium',
  },
]

function mockPremiumAccess(accessState: PremiumAccessState) {
  mockedUsePremiumAccess.mockReturnValue({
    accessState,
    errorMessage: null,
    isLoading: false,
    refresh: vi.fn(),
    signOut: vi.fn(),
    userEmail: accessState.isAuthenticated ? 'user@example.com' : null,
  })
}

beforeEach(() => {
  mockedCreatePremiumCheckoutSession.mockReset()
  mockedSignInWithGoogle.mockReset()
  mockedUsePremiumAccess.mockReset()
  mockedRefreshCatalogMetadata.mockReset()
  mockedAssignBrowserLocation.mockReset()
  mockedTrackMetaEvent.mockReset()
  mockedCreatePremiumCheckoutSession.mockResolvedValue('https://checkout.stripe.test/session')
  mockedSignInWithGoogle.mockResolvedValue(undefined)
  mockedRefreshCatalogMetadata.mockResolvedValue(catalogItems)
  mockPremiumAccess({
    isAuthenticated: false,
    status: 'signed_out',
    planCode: null,
  })
  window.localStorage.clear()
  window.history.replaceState({}, '', '/pricing/')
})

describe('PricingPage', () => {
  it('renders the original positioning with the installment option selected by default', async () => {
    render(<PricingPage />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /pague uma vez\s*tenha acesso vitalicio/i,
    )
    expect(
      await screen.findByText('3 prompts prontos para React + Tailwind'),
    ).toBeInTheDocument()
    expect(screen.getByText('1 prompts premium exclusivos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /10x de r\$ 5,99/i })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /pagar a vista/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.getByText('R$ 5,99')).toBeInTheDocument()
    expect(screen.getAllByText('10x').length).toBeGreaterThan(0)
  })

  it('starts Google login with the chosen one-time option when signed out', async () => {
    window.history.replaceState({}, '', '/pricing/?from=nexora-hero')

    render(<PricingPage />)

    fireEvent.click(screen.getByRole('switch', { name: /pagar a vista/i }))
    fireEvent.click(screen.getByRole('button', { name: /comprar acesso vitalicio/i }))

    await waitFor(() => {
      expect(mockedSignInWithGoogle).toHaveBeenCalledWith(
        '/pricing/?from=nexora-hero&purchase_option=one_time&intent=checkout',
      )
    })
    expect(mockedCreatePremiumCheckoutSession).not.toHaveBeenCalled()
  })

  it('opens Stripe checkout for the one-time option when already authenticated', async () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })
    window.history.replaceState({}, '', '/pricing/?from=nexora-hero&purchase_option=one_time')

    render(<PricingPage />)

    fireEvent.click(screen.getByRole('button', { name: /comprar acesso vitalicio/i }))

    await waitFor(() => {
      expect(mockedCreatePremiumCheckoutSession).toHaveBeenCalledWith({
        purchaseOption: 'one_time',
        sourceSlug: 'nexora-hero',
      })
    })
    expect(mockedTrackMetaEvent).toHaveBeenCalledWith('InitiateCheckout', {
      currency: 'BRL',
      num_items: 1,
      value: 59.9,
    })
    await waitFor(() => {
      expect(mockedAssignBrowserLocation).toHaveBeenCalledWith(
        'https://checkout.stripe.test/session',
      )
    })
  })

  it('opens Stripe checkout for installments with the recurring amount', async () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })
    window.history.replaceState(
      {},
      '',
      '/pricing/?from=nexora-hero',
    )

    render(<PricingPage />)

    fireEvent.click(screen.getByRole('button', { name: /10x de r\$ 5,99/i }))

    await waitFor(() => {
      expect(mockedCreatePremiumCheckoutSession).toHaveBeenCalledWith({
        purchaseOption: 'installments_10',
        sourceSlug: 'nexora-hero',
      })
    })
    expect(mockedTrackMetaEvent).toHaveBeenCalledWith('InitiateCheckout', {
      currency: 'BRL',
      num_items: 1,
      value: 5.99,
    })
  })

  it('continues to checkout automatically after auth using the selected purchase option', async () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })
    window.history.replaceState(
      {},
      '',
      '/pricing/?from=nexora-hero&purchase_option=installments_10&intent=checkout',
    )

    render(<PricingPage />)

    await waitFor(() => {
      expect(mockedCreatePremiumCheckoutSession).toHaveBeenCalledWith({
        purchaseOption: 'installments_10',
        sourceSlug: 'nexora-hero',
      })
    })
    expect(mockedTrackMetaEvent).toHaveBeenCalledWith('InitiateCheckout', {
      currency: 'BRL',
      num_items: 1,
      value: 5.99,
    })
    await waitFor(() => {
      expect(mockedAssignBrowserLocation).toHaveBeenCalledWith(
        'https://checkout.stripe.test/session',
      )
    })
  })

  it('sends premium users back to the catalog', async () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'active',
      planCode: 'premium',
    })

    render(<PricingPage />)

    fireEvent.click(screen.getByRole('button', { name: /abrir catalogo premium/i }))

    await waitFor(() => {
      expect(mockedAssignBrowserLocation).toHaveBeenCalledWith('/')
    })
    expect(mockedCreatePremiumCheckoutSession).not.toHaveBeenCalled()
  })

  it('answers the main buying objections in the faq', () => {
    render(<PricingPage />)

    expect(screen.getByText(/o que exatamente eu recebo ao comprar\?/i)).toBeInTheDocument()
    expect(screen.getByText(/isso e codigo pronto\?/i)).toBeInTheDocument()
    expect(screen.getByText(/como uso esses prompts no meu fluxo\?/i)).toBeInTheDocument()
  })
})
