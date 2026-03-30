import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { componentItems } from './data/components'
import { copyTextToClipboard } from './lib/copyTextToClipboard'

vi.mock('./lib/copyTextToClipboard', () => ({
  copyTextToClipboard: vi.fn(),
}))

const mockedCopy = vi.mocked(copyTextToClipboard)

const categoryExpectations = [
  ['Hero', 'AI Product Hero'],
  ['CTA', 'Split CTA Banner'],
  ['Pricing', 'Startup Pricing Grid'],
  ['Testimonials', 'Founder Quote Stack'],
  ['Features', 'Feature Bento Grid'],
  ['FAQ', 'Accordion FAQ Block'],
  ['Footer', 'Newsletter Footer'],
] as const

afterEach(() => {
  vi.useRealTimers()
  mockedCopy.mockReset()
})

describe('App', () => {
  it('renders the initial gallery view', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Component Prompt Gallery' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getAllByRole('article')).toHaveLength(21)
  })

  it('filters the grid for each category tab', async () => {
    const user = userEvent.setup()
    render(<App />)

    for (const [label, title] of categoryExpectations) {
      await user.click(screen.getByRole('tab', { name: label }))

      expect(screen.getByRole('tab', { name: label })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.getAllByRole('article')).toHaveLength(3)
      expect(
        screen.getByRole('heading', { name: title, level: 2 }),
      ).toBeInTheDocument()
    }
  })

  it('combines search with the active category', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Hero' }))
    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search components or categories',
      }),
      'agency',
    )

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(
      screen.getByRole('heading', { name: 'Agency Spotlight Hero', level: 2 }),
    ).toBeInTheDocument()
  })

  it('shows the empty state when nothing matches the query', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByRole('searchbox', {
        name: 'Search components or categories',
      }),
      'not-a-real-match',
    )

    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(screen.getByText('No components found')).toBeInTheDocument()
  })

  it('copies the selected prompt and resets the button state', async () => {
    vi.useFakeTimers()
    mockedCopy.mockResolvedValue(true)

    render(<App />)

    const button = within(screen.getAllByRole('article')[0]).getByRole(
      'button',
      { name: /copy prompt/i },
    )

    await act(async () => {
      fireEvent.click(button)
      await Promise.resolve()
    })

    expect(mockedCopy).toHaveBeenCalledWith(componentItems[0].prompt)
    expect(button).toHaveTextContent('Copied')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(button).toHaveTextContent('Copy prompt')
  })

  it('shows an error state when the copy helper fails', async () => {
    mockedCopy.mockResolvedValue(false)

    render(<App />)

    const button = within(screen.getAllByRole('article')[2]).getByRole(
      'button',
      { name: /copy prompt/i },
    )

    fireEvent.click(button)

    await waitFor(() => {
      expect(button).toHaveTextContent('Copy failed')
      expect(screen.getAllByText('Copy failed')).toHaveLength(2)
    })
  })

  it('supports keyboard activation for tabs', async () => {
    const user = userEvent.setup()
    render(<App />)

    const pricingTab = screen.getByRole('tab', { name: 'Pricing' })
    pricingTab.focus()
    await user.keyboard('[Enter]')

    expect(pricingTab).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', { name: 'Startup Pricing Grid', level: 2 }),
    ).toBeInTheDocument()
  })
})
