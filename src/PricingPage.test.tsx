import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPremiumCheckoutSession, requestMagicLink } from './auth/api'
import { usePremiumAccess } from './auth/usePremiumAccess'
import { assignBrowserLocation } from './lib/browserNavigation'
import { PricingPage } from './PricingPage'
import type { PremiumAccessState } from './types'

vi.mock('./auth/api', () => ({
  createPremiumCheckoutSession: vi.fn(),
  requestMagicLink: vi.fn(),
}))

vi.mock('./auth/usePremiumAccess', () => ({
  usePremiumAccess: vi.fn(),
}))

vi.mock('./lib/browserNavigation', () => ({
  assignBrowserLocation: vi.fn(),
}))

const mockedCreatePremiumCheckoutSession = vi.mocked(createPremiumCheckoutSession)
const mockedRequestMagicLink = vi.mocked(requestMagicLink)
const mockedUsePremiumAccess = vi.mocked(usePremiumAccess)
const mockedAssignBrowserLocation = vi.mocked(assignBrowserLocation)

function mockAccess(accessState: PremiumAccessState) {
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
  window.history.replaceState({}, '', '/pricing/?from=nexora-hero')
  mockedCreatePremiumCheckoutSession.mockReset()
  mockedRequestMagicLink.mockReset()
  mockedAssignBrowserLocation.mockReset()
  mockAccess({
    isAuthenticated: false,
    status: 'signed_out',
    planCode: null,
  })
})

describe('PricingPage', () => {
  it('sends a magic link and preserves the source slug in the next path', async () => {
    mockedRequestMagicLink.mockResolvedValue(undefined)

    render(<PricingPage />)

    fireEvent.change(screen.getByLabelText(/seu e-mail/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /receber magic link/i }))

    await waitFor(() => {
      expect(mockedRequestMagicLink).toHaveBeenCalledWith(
        'user@example.com',
        '/pricing/?from=nexora-hero',
      )
    })

    expect(screen.getByText(/link enviado para user@example.com/i)).toBeInTheDocument()
  })

  it('starts checkout for an authenticated account without active access', async () => {
    mockAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: null,
    })
    mockedCreatePremiumCheckoutSession.mockResolvedValue('https://checkout.stripe.test')

    render(<PricingPage />)

    fireEvent.click(screen.getByRole('button', { name: /comprar acesso vitalicio/i }))

    await waitFor(() => {
      expect(mockedCreatePremiumCheckoutSession).toHaveBeenCalledWith('nexora-hero')
    })

    expect(mockedAssignBrowserLocation).toHaveBeenCalledWith(
      'https://checkout.stripe.test',
    )
  })

  it('shows the active-access state instead of the checkout button when premium is already enabled', () => {
    mockAccess({
      isAuthenticated: true,
      status: 'active',
      planCode: 'premium',
    })

    render(<PricingPage />)

    expect(screen.getByText(/premium ativo nesta conta/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /confirmar acesso/i })).toHaveAttribute(
      'href',
      '/payment-success/',
    )
    expect(
      screen.queryByRole('button', { name: /comprar acesso vitalicio/i }),
    ).not.toBeInTheDocument()
  })
})
