import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePremiumAccess } from './auth/usePremiumAccess'
import { PaymentSuccessPage } from './PaymentSuccessPage'
import type { PremiumAccessState } from './types'

vi.mock('./auth/usePremiumAccess', () => ({
  usePremiumAccess: vi.fn(),
}))

const mockedUsePremiumAccess = vi.mocked(usePremiumAccess)

function mockAccess(accessState: PremiumAccessState) {
  const refresh = vi.fn().mockResolvedValue(undefined)

  mockedUsePremiumAccess.mockReturnValue({
    accessState,
    errorMessage: null,
    isLoading: false,
    refresh,
    signOut: vi.fn(),
    userEmail: accessState.isAuthenticated ? 'user@example.com' : null,
  })

  return refresh
}

beforeEach(() => {
  window.history.replaceState({}, '', '/payment-success/?source_slug=nexora-hero')
})

describe('PaymentSuccessPage', () => {
  it('shows the premium success state only after access becomes active', () => {
    mockAccess({
      isAuthenticated: true,
      status: 'active',
      planCode: 'premium',
    })

    render(<PaymentSuccessPage />)

    expect(screen.getByText(/premium liberado/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /abrir catalogo premium/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('keeps the page in verification mode while access is still pending', () => {
    const refresh = mockAccess({
      isAuthenticated: true,
      status: 'pending',
      planCode: 'premium',
    })

    render(<PaymentSuccessPage />)

    expect(screen.getByText(/confirmando seu pagamento/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /abrir catalogo premium/i }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /verificar novamente/i }))

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
