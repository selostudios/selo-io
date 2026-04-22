import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { StyleMemoPreview } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/style-memo-preview'

const ORG_ID = '11111111-1111-1111-1111-111111111111'

describe('StyleMemoPreview', () => {
  test('shows the empty-state message when the memo is blank', () => {
    render(<StyleMemoPreview orgId={ORG_ID} memo="" updatedAt={null} />)
    expect(
      screen.getByText(/Style memo empty — publish your first report to start the AI learning\./i)
    ).toBeInTheDocument()
  })

  test('shows the word count for a non-empty memo in the collapsed label', () => {
    const memo = 'Write with a confident, concrete voice and short sentences.'
    // 9 words
    render(<StyleMemoPreview orgId={ORG_ID} memo={memo} updatedAt="2026-04-21T10:00:00.000Z" />)
    expect(screen.getByTestId('style-memo-preview-toggle')).toHaveTextContent('9 words')
  })

  test('expands and collapses the memo content when the toggle is clicked', () => {
    const memo = 'Confident voice. Short sentences.'
    render(<StyleMemoPreview orgId={ORG_ID} memo={memo} updatedAt="2026-04-21T10:00:00.000Z" />)

    // Collapsed by default
    expect(screen.queryByTestId('style-memo-preview-content')).toBeNull()

    fireEvent.click(screen.getByTestId('style-memo-preview-toggle'))
    expect(screen.getByTestId('style-memo-preview-content')).toHaveTextContent(
      /Confident voice\. Short sentences\./
    )

    fireEvent.click(screen.getByTestId('style-memo-preview-toggle'))
    expect(screen.queryByTestId('style-memo-preview-content')).toBeNull()
  })

  test('links "Edit in settings" to the org settings page', () => {
    render(
      <StyleMemoPreview
        orgId={ORG_ID}
        memo="Confident voice."
        updatedAt="2026-04-21T10:00:00.000Z"
      />
    )

    fireEvent.click(screen.getByTestId('style-memo-preview-toggle'))
    const link = screen.getByRole('link', { name: /Edit in settings/i })
    expect(link).toHaveAttribute('href', `/${ORG_ID}/reports/performance/settings`)
  })
})
