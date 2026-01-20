import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportFilters } from '@/components/support/support-filters'
import type { FeedbackStatus, FeedbackCategory, FeedbackPriority } from '@/lib/types/feedback'

describe('SupportFilters', () => {
  const defaultProps = {
    status: undefined as FeedbackStatus | undefined,
    category: undefined as FeedbackCategory | undefined,
    priority: undefined as FeedbackPriority | undefined,
    onStatusChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onPriorityChange: vi.fn(),
    onClear: vi.fn(),
  }

  it('renders all filter dropdowns', () => {
    render(<SupportFilters {...defaultProps} />)

    expect(screen.getByText('All Statuses')).toBeInTheDocument()
    expect(screen.getByText('All Categories')).toBeInTheDocument()
    expect(screen.getByText('All Priorities')).toBeInTheDocument()
  })

  it('hides clear button when no filters active', () => {
    render(<SupportFilters {...defaultProps} />)

    expect(screen.queryByText('Clear')).not.toBeInTheDocument()
  })

  it('shows clear button when filters are active', () => {
    render(<SupportFilters {...defaultProps} status="new" />)

    expect(screen.getByText('Clear')).toBeInTheDocument()
  })

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn()
    render(<SupportFilters {...defaultProps} status="new" onClear={onClear} />)

    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalled()
  })
})
