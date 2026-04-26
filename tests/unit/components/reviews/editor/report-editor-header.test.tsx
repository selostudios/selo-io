import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { BackLink } from '@/components/reviews/editor/back-link'
import { ReportTitle } from '@/components/reviews/editor/report-title'
import { ReportEditorHeader } from '@/components/reviews/editor/report-editor-header'

describe('BackLink', () => {
  test('renders a link to the supplied href with the default label', () => {
    render(<BackLink href="/org-1/reports/performance" />)

    const link = screen.getByTestId('report-editor-back-link')
    expect(link).toHaveAttribute('href', '/org-1/reports/performance')
    expect(link).toHaveTextContent('← Back')
  })

  test('renders a custom label when provided', () => {
    render(<BackLink href="/org-1/reports/performance" label="← All reports" />)

    const link = screen.getByTestId('report-editor-back-link')
    expect(link).toHaveTextContent('← All reports')
    expect(link).not.toHaveTextContent('← Back')
  })
})

describe('ReportTitle', () => {
  test('renders the title as the page heading', () => {
    render(<ReportTitle title="Q1 2026 Performance" quarter="January – March 2026" />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Q1 2026 Performance' })
    ).toBeInTheDocument()
  })

  test('renders the quarter alongside the title', () => {
    render(<ReportTitle title="Q1 2026 Performance" quarter="January – March 2026" />)

    expect(screen.getByText('January – March 2026')).toBeInTheDocument()
  })
})

describe('ReportEditorHeader', () => {
  test('renders the back link, title, quarter, and actions in a single header', () => {
    render(
      <ReportEditorHeader
        backHref="/org-1/reports/performance"
        title="Q1 2026 Performance"
        quarter="January – March 2026"
        actions={<button data-testid="header-action-probe">Publish</button>}
      />
    )

    expect(screen.getByTestId('report-editor-back-link')).toHaveAttribute(
      'href',
      '/org-1/reports/performance'
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Q1 2026 Performance' })
    ).toBeInTheDocument()
    expect(screen.getByText('January – March 2026')).toBeInTheDocument()
    expect(screen.getByTestId('header-action-probe')).toBeInTheDocument()
  })

  test('places the actions slot inside a dedicated actions container', () => {
    render(
      <ReportEditorHeader
        backHref="/org-1/reports/performance"
        title="Q1 2026 Performance"
        quarter="January – March 2026"
        actions={<button data-testid="header-action-probe">Publish</button>}
      />
    )

    const actions = screen.getByTestId('report-editor-header-actions')
    expect(within(actions).getByTestId('header-action-probe')).toBeInTheDocument()
  })

  test('renders without actions when none are supplied', () => {
    render(
      <ReportEditorHeader
        backHref="/org-1/reports/performance"
        title="Q1 2026 Performance"
        quarter="January – March 2026"
      />
    )

    expect(screen.getByTestId('report-editor-back-link')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Q1 2026 Performance' })
    ).toBeInTheDocument()
  })
})
