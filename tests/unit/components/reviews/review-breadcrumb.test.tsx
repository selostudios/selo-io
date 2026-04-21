import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReviewBreadcrumb } from '@/components/reviews/review-breadcrumb'

describe('ReviewBreadcrumb', () => {
  test('renders every item label in order', () => {
    render(
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: '/org-1/reports/performance' },
          { label: 'Q1 2026', href: '/org-1/reports/performance/review-1' },
          { label: 'Snapshots' },
        ]}
      />
    )

    const crumbs = screen.getAllByRole('listitem')
    expect(crumbs.map((c) => c.textContent?.trim())).toEqual([
      'Performance reports',
      'Q1 2026',
      'Snapshots',
    ])
  })

  test('marks the last item as the current page', () => {
    render(
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: '/org-1/reports/performance' },
          { label: 'Snapshots' },
        ]}
      />
    )

    const current = screen.getByText('Snapshots').closest('li')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  test('renders items with href as links', () => {
    render(
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: '/org-1/reports/performance' },
          { label: 'Snapshots' },
        ]}
      />
    )

    const reportLink = screen.getByRole('link', { name: 'Performance reports' })
    expect(reportLink).toHaveAttribute('href', '/org-1/reports/performance')
  })

  test('renders items without href as plain text (not links)', () => {
    render(
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: '/org-1/reports/performance' },
          { label: 'Snapshots' },
        ]}
      />
    )

    // Current page should not be a link.
    expect(screen.queryByRole('link', { name: 'Snapshots' })).toBeNull()
    expect(screen.getByText('Snapshots')).toBeInTheDocument()
  })

  test('shows a visual separator between items but not after the last one', () => {
    const { container } = render(
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: '/org-1/reports/performance' },
          { label: 'Q1 2026', href: '/org-1/reports/performance/review-1' },
          { label: 'Snapshots' },
        ]}
      />
    )

    // Three items → two chevron separators.
    const separators = container.querySelectorAll('[aria-hidden="true"]')
    expect(separators.length).toBe(2)
  })

  test('treats an item lacking href as the current page even mid-list', () => {
    // Defensive: if someone constructs a breadcrumb where a non-final item
    // has no href, it still gets aria-current. This keeps the semantic
    // contract predictable.
    render(
      <ReviewBreadcrumb
        items={[
          { label: 'Performance reports', href: '/org-1/reports/performance' },
          { label: 'Q1 2026' },
          { label: 'Snapshots', href: '/org-1/reports/performance/review-1/snapshots' },
        ]}
      />
    )

    const middle = screen.getByText('Q1 2026').closest('li')
    expect(middle).toHaveAttribute('aria-current', 'page')
  })
})
