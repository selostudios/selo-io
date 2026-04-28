import { describe, test, expect, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSlideNoteAutosave } from '@/components/reviews/editor/use-slide-note-autosave'

vi.useFakeTimers()
vi.mock('@/lib/reviews/actions', () => ({
  updateSlideNote: vi.fn().mockResolvedValue({ success: true }),
}))

describe('useSlideNoteAutosave', () => {
  test('debounces updateSlideNote by 1.5s and reports status transitions', async () => {
    const { updateSlideNote } = await import('@/lib/reviews/actions')
    const { result } = renderHook(() => useSlideNoteAutosave('rev-1', 'ga_summary', ''))

    act(() => result.current.setValue('jargon'))
    expect(result.current.status).toBe('saving')
    expect(updateSlideNote).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateSlideNote).toHaveBeenCalledWith('rev-1', 'ga_summary', 'jargon')
    expect(result.current.status).toBe('saved')
  })

  test('reports error when action returns success: false', async () => {
    const { updateSlideNote } = await import('@/lib/reviews/actions')
    ;(updateSlideNote as unknown as Mock).mockResolvedValueOnce({ success: false, error: 'boom' })
    const { result } = renderHook(() => useSlideNoteAutosave('rev-1', 'ga_summary', ''))
    act(() => result.current.setValue('x'))
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('boom')
  })

  test('skips save when value is unchanged', async () => {
    const { updateSlideNote } = await import('@/lib/reviews/actions')
    ;(updateSlideNote as unknown as Mock).mockClear()
    const { result } = renderHook(() => useSlideNoteAutosave('rev-1', 'ga_summary', 'a'))
    act(() => result.current.setValue('a'))
    expect(result.current.status).toBe('idle')
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateSlideNote).not.toHaveBeenCalled()
  })
})
