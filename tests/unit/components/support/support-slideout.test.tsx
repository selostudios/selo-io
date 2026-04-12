import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportSlideout } from '@/components/support/support-slideout'
import type { FeedbackWithRelations } from '@/lib/types/feedback'

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
  it('opens in view mode showing static values when canEdit is true', () => {
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
    // Should show static values (view mode is the default)
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Looking into it')).toBeInTheDocument()
    // Should NOT show edit controls yet
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    // Should show Edit button
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('toggles to edit mode when Edit button is clicked', () => {
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

    // Should now show edit controls
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a note about this feedback...')).toBeInTheDocument()
    // Edit button should be hidden
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('renders static values when canEdit is false', () => {
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
    // Should NOT show Edit button
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('hides note section in view mode when no note exists', () => {
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
})
