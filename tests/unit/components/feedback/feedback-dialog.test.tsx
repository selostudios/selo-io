import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackProvider, useFeedback } from '@/components/feedback/feedback-provider'

// Mock the feedback action
vi.mock('@/app/feedback/actions', () => ({
  submitFeedback: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Helper component to open the dialog for testing
function OpenDialogButton() {
  const { openFeedback } = useFeedback()
  return <button onClick={openFeedback}>Open Dialog</button>
}

// Test wrapper that provides the feedback context with dialog open trigger
function DialogTestWrapper() {
  return (
    <FeedbackProvider>
      <OpenDialogButton />
      <FeedbackDialog />
    </FeedbackProvider>
  )
}

describe('FeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Form Validation', () => {
    it('submit button is disabled when form is empty', async () => {
      render(<DialogTestWrapper />)

      // Open the dialog
      fireEvent.click(screen.getByText('Open Dialog'))

      // Wait for dialog to open
      const submitButton = await screen.findByRole('button', { name: 'Submit' })

      // Submit button should be disabled
      expect(submitButton).toBeDisabled()
    })

    it('submit button is disabled when title is too short', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const titleInput = await screen.findByLabelText('Title')
      const descriptionInput = screen.getByLabelText('Description')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      // Enter short title and valid description
      fireEvent.change(titleInput, { target: { value: 'AB' } }) // 2 chars, needs 3
      fireEvent.change(descriptionInput, {
        target: { value: 'This is a valid description with enough characters.' },
      })

      expect(submitButton).toBeDisabled()
    })

    it('submit button is disabled when description is too short', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const titleInput = await screen.findByLabelText('Title')
      const descriptionInput = screen.getByLabelText('Description')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      // Enter valid title and short description
      fireEvent.change(titleInput, { target: { value: 'Valid Title' } })
      fireEvent.change(descriptionInput, { target: { value: 'Short' } }) // 5 chars, needs 10

      expect(submitButton).toBeDisabled()
    })

    it('submit button is enabled when form is valid', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const titleInput = await screen.findByLabelText('Title')
      const descriptionInput = screen.getByLabelText('Description')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      // Enter valid title and description
      fireEvent.change(titleInput, { target: { value: 'Valid Title' } })
      fireEvent.change(descriptionInput, {
        target: { value: 'This is a valid description with enough characters.' },
      })

      expect(submitButton).not.toBeDisabled()
    })

    it('shows validation message for short title', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const titleInput = await screen.findByLabelText('Title')

      // Enter short title
      fireEvent.change(titleInput, { target: { value: 'AB' } })

      // Should show validation message
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument()
    })

    it('shows validation message for short description', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const descriptionInput = await screen.findByLabelText('Description')

      // Enter short description
      fireEvent.change(descriptionInput, { target: { value: 'Short' } })

      // Should show validation message
      expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument()
    })

    it('hides validation message when empty (no premature errors)', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      // Dialog is open but fields are empty
      await screen.findByLabelText('Title')

      // Should NOT show validation messages for empty fields
      expect(screen.queryByText('Title must be at least 3 characters')).not.toBeInTheDocument()
      expect(
        screen.queryByText('Description must be at least 10 characters')
      ).not.toBeInTheDocument()
    })

    it('validates based on trimmed input (whitespace only is invalid)', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const titleInput = await screen.findByLabelText('Title')
      const descriptionInput = screen.getByLabelText('Description')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      // Enter whitespace-only values
      fireEvent.change(titleInput, { target: { value: '   ' } })
      fireEvent.change(descriptionInput, { target: { value: '          ' } })

      // Submit should still be disabled (trimmed values are empty)
      expect(submitButton).toBeDisabled()
    })

    it('enables submit at exact minimum lengths', async () => {
      render(<DialogTestWrapper />)

      fireEvent.click(screen.getByText('Open Dialog'))

      const titleInput = await screen.findByLabelText('Title')
      const descriptionInput = screen.getByLabelText('Description')
      const submitButton = screen.getByRole('button', { name: 'Submit' })

      // Enter exactly minimum length values
      fireEvent.change(titleInput, { target: { value: 'ABC' } }) // exactly 3 chars
      fireEvent.change(descriptionInput, { target: { value: '1234567890' } }) // exactly 10 chars

      expect(submitButton).not.toBeDisabled()
    })
  })
})
