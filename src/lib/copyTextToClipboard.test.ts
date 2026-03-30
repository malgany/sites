import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from './copyTextToClipboard'

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
)
const originalExecCommand = document.execCommand

function setClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
}

function setExecCommand(mock: ReturnType<typeof vi.fn>) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: mock,
  })
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard)
  } else {
    Reflect.deleteProperty(navigator, 'clipboard')
  }

  if (originalExecCommand) {
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: originalExecCommand,
    })
  } else {
    Reflect.deleteProperty(document, 'execCommand')
  }

  vi.restoreAllMocks()
})

describe('copyTextToClipboard', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)

    await expect(copyTextToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'))
    const execCommand = vi.fn(() => true)
    setClipboard(writeText)
    setExecCommand(execCommand)

    await expect(copyTextToClipboard('fallback')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('fallback')
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('returns false when both copy paths fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'))
    const execCommand = vi.fn(() => false)
    setClipboard(writeText)
    setExecCommand(execCommand)

    await expect(copyTextToClipboard('failure')).resolves.toBe(false)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
