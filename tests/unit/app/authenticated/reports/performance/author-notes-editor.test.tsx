import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

const updateAuthorNotes = vi.fn()

vi.mock('@/lib/reviews/actions', () => ({
  updateAuthorNotes: (...args: unknown[]) => updateAuthorNotes(...args),
}))

import { AuthorNotesEditor } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/author-notes-editor'

const REVIEW_ID = '22222222-2222-2222-2222-222222222222'

describe('AuthorNotesEditor', () => {
  beforeEach(() => {
    updateAuthorNotes.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('hydrates the textarea from initialNotes', () => {
    render(
      <AuthorNotesEditor reviewId={REVIEW_ID} initialNotes="Paid burst last quarter." canEdit />
    )
    expect(screen.getByTestId('author-notes-textarea')).toHaveValue('Paid burst last quarter.')
  })

  test('autosaves the latest value after the debounce window', async () => {
    updateAuthorNotes.mockResolvedValue({ success: true })
    render(<AuthorNotesEditor reviewId={REVIEW_ID} initialNotes="" canEdit />)

    fireEvent.change(screen.getByTestId('author-notes-textarea'), {
      target: { value: 'Team restructured mid-quarter.' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(updateAuthorNotes).toHaveBeenCalledWith(REVIEW_ID, 'Team restructured mid-quarter.')
    expect(screen.getByTestId('author-notes-save-status')).toHaveTextContent('Saved')
  })

  test('does not autosave when canEdit is false', async () => {
    render(<AuthorNotesEditor reviewId={REVIEW_ID} initialNotes="" canEdit={false} />)

    const textarea = screen.getByTestId('author-notes-textarea')
    expect(textarea).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'anything' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(updateAuthorNotes).not.toHaveBeenCalled()
  })

  test('surfaces the server error message when save fails', async () => {
    updateAuthorNotes.mockResolvedValue({ success: false, error: 'db offline' })
    render(<AuthorNotesEditor reviewId={REVIEW_ID} initialNotes="" canEdit />)

    fireEvent.change(screen.getByTestId('author-notes-textarea'), {
      target: { value: 'notes' },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(screen.getByTestId('author-notes-save-status')).toHaveTextContent('db offline')
  })

  test('collapses rapid edits into a single save for the final value', async () => {
    updateAuthorNotes.mockResolvedValue({ success: true })
    render(<AuthorNotesEditor reviewId={REVIEW_ID} initialNotes="" canEdit />)

    const textarea = screen.getByTestId('author-notes-textarea')
    fireEvent.change(textarea, { target: { value: 'a' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    fireEvent.change(textarea, { target: { value: 'ab' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    fireEvent.change(textarea, { target: { value: 'abc' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    expect(updateAuthorNotes).toHaveBeenCalledTimes(1)
    expect(updateAuthorNotes).toHaveBeenCalledWith(REVIEW_ID, 'abc')
  })
})
