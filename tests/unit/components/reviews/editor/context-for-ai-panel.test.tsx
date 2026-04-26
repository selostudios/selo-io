import { describe, test, expect, vi, beforeEach, afterAll, type Mock } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ContextForAiPanel } from '@/components/reviews/editor/context-for-ai-panel'

vi.useFakeTimers()
vi.mock('@/lib/reviews/actions', () => ({
  updateAuthorNotes: vi.fn().mockResolvedValue({ success: true }),
}))

afterAll(() => {
  vi.useRealTimers()
})

describe('ContextForAiPanel', () => {
  beforeEach(async () => {
    const { updateAuthorNotes } = await import('@/lib/reviews/actions')
    ;(updateAuthorNotes as unknown as Mock).mockClear()
    ;(updateAuthorNotes as unknown as Mock).mockResolvedValue({ success: true })
  })

  test('renders the "Context for AI" heading and the textarea seeded with initialNotes', () => {
    render(
      <ContextForAiPanel
        reviewId="rev-1"
        initialNotes="Q1 launch overshadowed paid spend."
        canEdit
      />
    )

    expect(screen.getByRole('heading', { name: /context for ai/i })).toBeInTheDocument()
    expect(screen.getByTestId('context-for-ai-textarea')).toHaveValue(
      'Q1 launch overshadowed paid spend.'
    )
  })

  test('autosaves edits through updateAuthorNotes after the 1.5s debounce window', async () => {
    const { updateAuthorNotes } = await import('@/lib/reviews/actions')

    render(<ContextForAiPanel reviewId="rev-1" initialNotes="" canEdit />)

    fireEvent.change(screen.getByTestId('context-for-ai-textarea'), {
      target: { value: 'New product launched mid-quarter; expect spike in branded search.' },
    })

    expect(updateAuthorNotes).not.toHaveBeenCalled()
    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent(/saving/i)

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(updateAuthorNotes).toHaveBeenCalledWith(
      'rev-1',
      'New product launched mid-quarter; expect spike in branded search.'
    )
    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent(/saved/i)
  })

  test('surfaces the action error message when the save fails', async () => {
    const { updateAuthorNotes } = await import('@/lib/reviews/actions')
    ;(updateAuthorNotes as unknown as Mock).mockResolvedValueOnce({
      success: false,
      error: 'No write access',
    })

    render(<ContextForAiPanel reviewId="rev-1" initialNotes="" canEdit />)

    fireEvent.change(screen.getByTestId('context-for-ai-textarea'), {
      target: { value: 'Notes that will fail to save.' },
    })

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent('No write access')
  })

  test('disables the textarea and skips autosave when canEdit is false', async () => {
    const { updateAuthorNotes } = await import('@/lib/reviews/actions')

    render(<ContextForAiPanel reviewId="rev-1" initialNotes="Read-only context." canEdit={false} />)

    const textarea = screen.getByTestId('context-for-ai-textarea')
    expect(textarea).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'Trying to edit anyway.' } })

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(updateAuthorNotes).not.toHaveBeenCalled()
  })

  test('discards stale in-flight save responses when a newer keystroke is in flight', async () => {
    const { updateAuthorNotes } = await import('@/lib/reviews/actions')
    ;(updateAuthorNotes as unknown as Mock).mockClear()
    let resolveFirst: ((value: { success: true }) => void) | undefined
    ;(updateAuthorNotes as unknown as Mock)
      .mockImplementationOnce(
        () =>
          new Promise<{ success: true }>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce({ success: true })

    render(<ContextForAiPanel reviewId="rev-1" initialNotes="" canEdit />)

    const textarea = screen.getByTestId('context-for-ai-textarea')

    // First keystroke + debounce -> first save begins (and remains in-flight).
    fireEvent.change(textarea, { target: { value: 'first' } })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateAuthorNotes).toHaveBeenCalledWith('rev-1', 'first')
    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent(/saving/i)

    // Second keystroke bumps the request id and reschedules the timer.
    // Status returns to "saving" via the new save's debounce branch.
    fireEvent.change(textarea, { target: { value: 'second' } })
    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent(/saving/i)

    // Stale first save resolves while the second is still pending — must not flip to "saved".
    await act(async () => {
      resolveFirst?.({ success: true })
    })
    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent(/saving/i)

    // Second save fires and resolves successfully.
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateAuthorNotes).toHaveBeenCalledWith('rev-1', 'second')
    expect(screen.getByTestId('context-for-ai-save-status')).toHaveTextContent(/saved/i)
  })
})
