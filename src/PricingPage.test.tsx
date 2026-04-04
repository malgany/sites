import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPremiumCheckoutSession, signInWithGoogle } from './auth/api'
import { usePremiumAccess } from './auth/usePremiumAccess'
import { PricingPage } from './PricingPage'
import { assignBrowserLocation } from './lib/browserNavigation'
import type { PremiumAccessState } from './types'

vi.mock('./auth/api', () => ({
  createPremiumCheckoutSession: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

vi.mock('./auth/usePremiumAccess', () => ({
  usePremiumAccess: vi.fn(),
}))

vi.mock('./lib/browserNavigation', () => ({
  assignBrowserLocation: vi.fn(),
}))

const mockedCreatePremiumCheckoutSession = vi.mocked(createPremiumCheckoutSession)
const mockedSignInWithGoogle = vi.mocked(signInWithGoogle)
const mockedUsePremiumAccess = vi.mocked(usePremiumAccess)
const mockedAssignBrowserLocation = vi.mocked(assignBrowserLocation)

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
  mockedAssignBrowserLocation.mockReset()
  mockedCreatePremiumCheckoutSession.mockResolvedValue('https://checkout.stripe.test/session')
  mockedSignInWithGoogle.mockResolvedValue(undefined)
  mockPremiumAccess({
    isAuthenticated: false,
    status: 'signed_out',
    planCode: null,
  })
  window.history.replaceState({}, '', '/pricing/')
})

describe('PricingPage', () => {
  it('starts Google login when the visitor tries to buy while signed out', async () => {
    window.history.replaceState({}, '', '/pricing/?from=nexora-hero')

    render(<PricingPage />)

    expect(screen.getByRole('heading', { name: /pague 1 vez/i, level: 1 })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /entrar com google/i }))

    await waitFor(() => {
      expect(mockedSignInWithGoogle).toHaveBeenCalledWith(
        '/pricing/?from=nexora-hero&intent=checkout',
      )
    })
    expect(mockedCreatePremiumCheckoutSession).not.toHaveBeenCalled()
  })

  it('opens Stripe checkout when the visitor is already authenticated', async () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })
    window.history.replaceState({}, '', '/pricing/?from=nexora-hero')

    render(<PricingPage />)

    fireEvent.click(screen.getByRole('button', { name: /ir para pagamento/i }))

    await waitFor(() => {
      expect(mockedCreatePremiumCheckoutSession).toHaveBeenCalledWith('nexora-hero')
    })
    expect(mockedAssignBrowserLocation).toHaveBeenCalledWith(
      'https://checkout.stripe.test/session',
    )
  })

  it('continues to checkout automatically after returning authenticated with checkout intent', async () => {
    mockPremiumAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })
    window.history.replaceState({}, '', '/pricing/?from=nexora-hero&intent=checkout')

    render(<PricingPage />)

    await waitFor(() => {
      expect(mockedCreatePremiumCheckoutSession).toHaveBeenCalledWith('nexora-hero')
    })
    expect(mockedAssignBrowserLocation).toHaveBeenCalledWith(
      'https://checkout.stripe.test/session',
    )
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
})
