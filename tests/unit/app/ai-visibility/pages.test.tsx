import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AIVisibilityPromptsPage from '@/app/(authenticated)/[orgId]/ai-visibility/prompts/page'
import AIVisibilityMentionsPage from '@/app/(authenticated)/[orgId]/ai-visibility/mentions/page'

describe('AI Visibility stub pages', () => {
  it('renders prompts page with empty state', () => {
    render(<AIVisibilityPromptsPage />)

    expect(screen.getByTestId('ai-visibility-prompts-page-title')).toHaveTextContent('Prompts')
    expect(screen.getByText('No prompts configured')).toBeInTheDocument()
  })

  it('renders mentions page with empty state', () => {
    render(<AIVisibilityMentionsPage />)

    expect(screen.getByTestId('ai-visibility-mentions-page-title')).toHaveTextContent(
      'Brand Mentions'
    )
    expect(screen.getByText('No mentions yet')).toBeInTheDocument()
  })
})
