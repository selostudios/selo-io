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
})
