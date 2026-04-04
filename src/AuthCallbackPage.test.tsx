import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exchangeAuthCode } from './auth/api'
import { AuthCallbackPage } from './AuthCallbackPage'
import { replaceBrowserLocation } from './lib/browserNavigation'

vi.mock('./auth/api', () => ({
  exchangeAuthCode: vi.fn(),
}))

vi.mock('./auth/client', () => ({
  getBrowserAuthSupabaseClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: null,
        },
        error: null,
      }),
    },
  })),
}))

vi.mock('./lib/browserNavigation', () => ({
  replaceBrowserLocation: vi.fn(),
}))

const mockedExchangeAuthCode = vi.mocked(exchangeAuthCode)
const mockedReplaceBrowserLocation = vi.mocked(replaceBrowserLocation)

beforeEach(() => {
  mockedExchangeAuthCode.mockReset()
  mockedReplaceBrowserLocation.mockReset()
  window.history.replaceState(
    {},
    '',
    '/auth/callback/?code=oauth-code&next=%2Fpricing%2F%3Ffrom%3Dnexora-hero',
  )
})

describe('AuthCallbackPage', () => {
  it('exchanges the auth code and redirects back to the requested pricing page', async () => {
    mockedExchangeAuthCode.mockResolvedValue(undefined)

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(mockedExchangeAuthCode).toHaveBeenCalledWith('oauth-code')
    })

    expect(mockedReplaceBrowserLocation).toHaveBeenCalledWith(
      '/pricing/?from=nexora-hero',
    )
    expect(screen.getByText(/confirmando login/i)).toBeInTheDocument()
  })
})
