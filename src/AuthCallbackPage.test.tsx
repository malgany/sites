import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exchangeMagicLinkCode } from './auth/api'
import { AuthCallbackPage } from './AuthCallbackPage'
import { replaceBrowserLocation } from './lib/browserNavigation'

vi.mock('./auth/api', () => ({
  exchangeMagicLinkCode: vi.fn(),
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

const mockedExchangeMagicLinkCode = vi.mocked(exchangeMagicLinkCode)
const mockedReplaceBrowserLocation = vi.mocked(replaceBrowserLocation)

beforeEach(() => {
  mockedExchangeMagicLinkCode.mockReset()
  mockedReplaceBrowserLocation.mockReset()
  window.history.replaceState(
    {},
    '',
    '/auth/callback/?code=magic-code&next=%2Fpricing%2F%3Ffrom%3Dnexora-hero',
  )
})

describe('AuthCallbackPage', () => {
  it('exchanges the auth code and redirects back to the requested pricing page', async () => {
    mockedExchangeMagicLinkCode.mockResolvedValue(undefined)

    render(<AuthCallbackPage />)

    await waitFor(() => {
      expect(mockedExchangeMagicLinkCode).toHaveBeenCalledWith('magic-code')
    })

    expect(mockedReplaceBrowserLocation).toHaveBeenCalledWith(
      '/pricing/?from=nexora-hero',
    )
    expect(screen.getByText(/confirmando seu login/i)).toBeInTheDocument()
  })
})
