import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  it('renders edit form when readOnly is false', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        readOnly={false}
      />
    )

    expect(screen.getByText('Test Bug Report')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Add a note about this feedback...')).toBeInTheDocument()
  })

  it('renders static values when readOnly is true', () => {
    render(
      <SupportSlideout
        feedback={mockFeedback}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        readOnly={true}
      />
    )

    expect(screen.getByText('Test Bug Report')).toBeInTheDocument()
    // Should show static status/priority text
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    // Should show the note as static text
    expect(screen.getByText('Looking into it')).toBeInTheDocument()
    // Should NOT show edit controls
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText('Add a note about this feedback...')
    ).not.toBeInTheDocument()
  })

  it('hides note section in readOnly mode when no note exists', () => {
    const feedbackNoNote = { ...mockFeedback, status_note: null }
    render(
      <SupportSlideout
        feedback={feedbackNoNote}
        open={true}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
        readOnly={true}
      />
    )

    // Note label should not appear since there's no note to display
    expect(screen.queryByText('Note')).not.toBeInTheDocument()
    // Save button should not be present
    expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
  })

  it('renders nothing when feedback is null', () => {
    const { container } = render(
      <SupportSlideout feedback={null} open={true} onClose={vi.fn()} onUpdate={vi.fn()} />
    )

    expect(container.innerHTML).toBe('')
  })
})
