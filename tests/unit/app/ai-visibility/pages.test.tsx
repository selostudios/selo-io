import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AIVisibilityMentionsPage from '@/app/(authenticated)/[orgId]/ai-visibility/mentions/page'

describe('AI Visibility stub pages', () => {
  // PromptsPage is now a server component (async with supabase) and cannot be unit tested with render.
  // It is covered by integration/E2E tests.

  it('renders mentions page with empty state', () => {
    render(<AIVisibilityMentionsPage />)

    expect(screen.getByTestId('ai-visibility-mentions-page-title')).toHaveTextContent(
      'Brand Mentions'
    )
    expect(screen.getByText('No mentions yet')).toBeInTheDocument()
  })
})
