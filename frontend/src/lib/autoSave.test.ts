import { describe, expect, it, vi } from 'vitest'
import { createDebouncedRunner } from './autoSave'

describe('auto save debounce', () => {
  it('runs only the last scheduled callback', () => {
    vi.useFakeTimers()

    const runner = createDebouncedRunner(500)
    const first = vi.fn()
    const second = vi.fn()

    runner.schedule(first)
    vi.advanceTimersByTime(300)
    runner.schedule(second)
    vi.advanceTimersByTime(499)

    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('cancels pending callback', () => {
    vi.useFakeTimers()

    const runner = createDebouncedRunner(500)
    const callback = vi.fn()

    runner.schedule(callback)
    runner.cancel()
    vi.advanceTimersByTime(500)

    expect(callback).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
