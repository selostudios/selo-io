import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportTable } from '@/components/support/support-table'
import type { FeedbackWithRelations } from '@/lib/types/feedback'

const mockFeedback: FeedbackWithRelations[] = [
  {
    id: '1',
    title: 'Test Bug',
    description: 'A test bug description',
    category: 'bug',
    status: 'new',
    priority: 'high',
    submitted_by: 'user-1',
    organization_id: 'org-1',
    page_url: 'https://example.com/page',
    user_agent: 'Mozilla/5.0',
    screenshot_url: null,
    status_note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    submitter: { id: 'user-1', first_name: 'John', last_name: 'Doe' },
    organization: { id: 'org-1', name: 'Test Org' },
  },
]

describe('SupportTable', () => {
  it('renders empty state when no feedback', () => {
    render(<SupportTable feedback={[]} onView={vi.fn()} />)

    expect(screen.getByText('No feedback items found')).toBeInTheDocument()
  })

  it('renders feedback items', () => {
    render(<SupportTable feedback={mockFeedback} onView={vi.fn()} />)

    expect(screen.getByText('Test Bug')).toBeInTheDocument()
    expect(screen.getByText('Bug')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows View and Delete buttons when canEdit is true', () => {
    render(
      <SupportTable feedback={mockFeedback} onView={vi.fn()} onDelete={vi.fn()} canEdit={true} />
    )

    expect(screen.getByRole('button', { name: 'View feedback' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete feedback' })).toBeInTheDocument()
  })

  it('hides action buttons when canEdit is false', () => {
    render(<SupportTable feedback={mockFeedback} onView={vi.fn()} canEdit={false} />)

    expect(screen.queryByRole('button', { name: 'View feedback' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete feedback' })).not.toBeInTheDocument()
  })

  it('calls onView when View button clicked', () => {
    const onView = vi.fn()
    render(
      <SupportTable feedback={mockFeedback} onView={onView} onDelete={vi.fn()} canEdit={true} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'View feedback' }))
    expect(onView).toHaveBeenCalledWith(mockFeedback[0])
  })

  it('calls onDelete when Delete button clicked', () => {
    const onDelete = vi.fn()
    render(
      <SupportTable feedback={mockFeedback} onView={vi.fn()} onDelete={onDelete} canEdit={true} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete feedback' }))
    expect(onDelete).toHaveBeenCalledWith(mockFeedback[0])
  })

  it('shows dash for missing priority', () => {
    const feedbackWithoutPriority = [{ ...mockFeedback[0], priority: null }]
    render(<SupportTable feedback={feedbackWithoutPriority} onView={vi.fn()} />)

    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('shows Unknown when submitter is missing', () => {
    const feedbackWithoutSubmitter = [{ ...mockFeedback[0], submitter: undefined }]
    render(<SupportTable feedback={feedbackWithoutSubmitter} onView={vi.fn()} />)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('shows email when submitter name is empty', () => {
    const feedbackWithEmailOnly = [
      {
        ...mockFeedback[0],
        submitter: { id: 'user-1', first_name: null, last_name: null, email: 'test@example.com' },
      },
    ]
    render(<SupportTable feedback={feedbackWithEmailOnly} onView={vi.fn()} />)

    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })
})
