import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SupportSlideout } from '@/components/support/support-slideout'
import type { FeedbackWithRelations } from '@/lib/types/feedback'

vi.mock('@/app/(authenticated)/support/actions', () => ({
  updateFeedbackStatus: vi.fn().mockResolvedValue({ success: true }),
  updateFeedback: vi.fn().mockResolvedValue({ success: true }),
}))

const mockFeedback: FeedbackWithRelations = {
  id: '1',
  title: 'Test Bug Report',
  description: 'Something is broken',
  category: 'bug',
  status: 'new',
  priority: 'high',
  submitted_by: 'user-1',
  organization_id: 'org-1',
  page_url: 'https://example.com/page',
  user_agent: 'Mozilla/5.0',
  screenshot_url: null,
  status_note: 'Looking into it',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  submitter: { id: 'user-1', first_name: 'Jane', last_name: 'Smith' },
  organization: { id: 'org-1', name: 'Test Org' },
}

describe('SupportSlideout', () => {
  it('shows editable controls when canEdit is true', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        canEdit={true}
      />
    )

    expect(screen.getByText('Test Bug Report')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a note about this feedback...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('shows static values when canEdit is false', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        canEdit={false}
      />
    )

    expect(screen.getByText('Test Bug Report')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Looking into it')).toBeInTheDocument()
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('hides note section in read-only mode when no note exists', () => {
    const feedbackNoNote = { ...mockFeedback, status_note: null }
    render(
      <SupportSlideout
        feedback={feedbackNoNote}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        canEdit={false}
      />
    )

    expect(screen.queryByText('Note')).not.toBeInTheDocument()
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
  })

  it('renders nothing when feedback is null', () => {
    const { container } = render(
      <SupportSlideout feedback={null} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('enters edit mode when Edit button is clicked', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        canEdit={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))

    expect(screen.getByLabelText('Title')).toHaveValue('Test Bug Report')
    expect(screen.getByLabelText('Description')).toHaveValue('Something is broken')
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
  })

  it('cancels edit mode and reverts to read view', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        canEdit={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByLabelText('Title')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByText('Something is broken')).toBeInTheDocument()
  })

  it('calls updateFeedback on save and triggers onUpdate', async () => {
    const { updateFeedback } = await import('@/app/(authenticated)/support/actions')
    const onUpdate = vi.fn()

    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={onUpdate}
        canEdit={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))

    const titleInput = screen.getByLabelText('Title')
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } })

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(updateFeedback).toHaveBeenCalledWith({
        feedbackId: '1',
        title: 'Updated Title',
        description: 'Something is broken',
        category: 'bug',
      })
    })

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled()
    })
  })

  it('disables save button when title is empty in edit mode', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        canEdit={true}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /edit/i }))

    const titleInput = screen.getByLabelText('Title')
    fireEvent.change(titleInput, { target: { value: '' } })

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })
})
