import { describe, test, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/lib/reviews/actions', () => ({
  updateSlideNote: vi.fn().mockResolvedValue({ success: true }),
}))

import { SlideNoteButton } from '@/components/reviews/editor/slide-note-button'

describe('SlideNoteButton', () => {
  test('shows the dot indicator when an existing note has content', () => {
    render(
      <SlideNoteButton reviewId="rev-1" blockKey="ga_summary" initialValue="Watch the jargon." />
    )
    expect(screen.getByTestId('slide-note-indicator-ga_summary')).toBeInTheDocument()
  })

  test('hides the dot indicator when the note is empty or whitespace', () => {
    render(<SlideNoteButton reviewId="rev-1" blockKey="ga_summary" initialValue="   " />)
    expect(screen.queryByTestId('slide-note-indicator-ga_summary')).not.toBeInTheDocument()
  })

  test('opens the popover and seeds the textarea with the existing value', () => {
    render(
      <SlideNoteButton reviewId="rev-1" blockKey="ga_summary" initialValue="Stop the jargon." />
    )
    fireEvent.click(screen.getByTestId('slide-note-button-ga_summary'))
    const textarea = screen.getByTestId('slide-note-input-ga_summary') as HTMLTextAreaElement
    expect(textarea.value).toBe('Stop the jargon.')
  })
})
