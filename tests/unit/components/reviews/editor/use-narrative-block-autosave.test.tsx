import { describe, test, expect, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'

vi.useFakeTimers()
vi.mock('@/lib/reviews/actions', () => ({
  updateNarrative: vi.fn().mockResolvedValue({ success: true }),
}))

describe('useNarrativeBlockAutosave', () => {
  test('debounces updateNarrative by 1.5s and reports status transitions', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    const { result } = renderHook(() => useNarrativeBlockAutosave('rev-1', 'ga_summary', 'initial'))

    expect(result.current.status).toBe('idle')

    act(() => result.current.setValue('next'))
    expect(result.current.status).toBe('saving')
    expect(updateNarrative).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).toHaveBeenCalledWith('rev-1', 'ga_summary', 'next')
    expect(result.current.status).toBe('saved')
  })

  test('reports error when action returns success: false', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    ;(updateNarrative as unknown as Mock).mockResolvedValueOnce({ success: false, error: 'boom' })
    const { result } = renderHook(() => useNarrativeBlockAutosave('rev-1', 'ga_summary', ''))
    act(() => result.current.setValue('x'))
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('boom')
  })

  test('does not let a stale in-flight save downgrade a fresh saving state', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    ;(updateNarrative as unknown as Mock).mockClear()
    let resolveFirst: ((value: { success: true }) => void) | undefined
    ;(updateNarrative as unknown as Mock)
      .mockImplementationOnce(
        () =>
          new Promise<{ success: true }>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce({ success: true })

    const { result } = renderHook(() => useNarrativeBlockAutosave('rev-1', 'ga_summary', ''))

    act(() => result.current.setValue('a'))
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    // First save dispatched but unresolved.

    act(() => result.current.setValue('ab'))
    expect(result.current.status).toBe('saving')

    // Resolve the stale first save while the second is still pending.
    await act(async () => {
      resolveFirst?.({ success: true })
    })
    expect(result.current.status).toBe('saving')

    // Let the second save fire and resolve.
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.status).toBe('saved')
    expect(updateNarrative).toHaveBeenNthCalledWith(2, 'rev-1', 'ga_summary', 'ab')
  })

  test('cancels pending save when unmounted before the debounce window elapses', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    ;(updateNarrative as unknown as Mock).mockClear()

    const { result, unmount } = renderHook(() =>
      useNarrativeBlockAutosave('rev-1', 'ga_summary', '')
    )
    act(() => result.current.setValue('x'))
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).not.toHaveBeenCalled()
  })

  test('skips save and stays idle when value is unchanged', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    ;(updateNarrative as unknown as Mock).mockClear()

    const { result } = renderHook(() => useNarrativeBlockAutosave('rev-1', 'ga_summary', 'a'))
    act(() => result.current.setValue('a'))
    expect(result.current.status).toBe('idle')

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })
})
