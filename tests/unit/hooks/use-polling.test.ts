import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePolling } from '@/hooks/use-polling'

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('polls at the specified interval', async () => {
    let callCount = 0
    const fetcher = vi.fn(async () => {
      callCount++
      return { count: callCount }
    })

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        intervalMs: 1000,
        isComplete: (data) => data.count >= 3,
      })
    )

    // Initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)

    // Third poll — isComplete returns true, should stop
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)

    // No more polls
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  test('does not poll when disabled', async () => {
    const fetcher = vi.fn(async () => ({ done: false }))

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: false,
        isComplete: () => false,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(fetcher).not.toHaveBeenCalled()
  })

  test('calls onComplete when isComplete returns true', async () => {
    const onComplete = vi.fn()
    const fetcher = vi.fn(async () => ({ done: true }))

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        isComplete: (data) => data.done,
        onComplete,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(onComplete).toHaveBeenCalledWith({ done: true })
  })

  test('uses error interval on fetch failure', async () => {
    let callCount = 0
    const fetcher = vi.fn(async () => {
      callCount++
      if (callCount === 1) throw new Error('Network error')
      return { ok: true }
    })

    renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        intervalMs: 1000,
        errorIntervalMs: 3000,
        isComplete: (data) => data.ok,
      })
    )

    // First call fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Should wait 3000ms (error interval), not 1000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetcher).toHaveBeenCalledTimes(1) // Still 1

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2) // Now 2
  })

  test('returns isLoading true until first successful fetch', async () => {
    const fetcher = vi.fn(async () => ({ value: 42 }))

    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        enabled: true,
        isComplete: () => false,
      })
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual({ value: 42 })
  })
})
