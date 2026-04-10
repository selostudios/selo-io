import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionCard } from '@/components/ai-visibility/mention-card'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import type { MentionResult } from '@/lib/ai-visibility/queries'

const baseMention: MentionResult = {
  id: '1',
  organization_id: 'org-1',
  prompt_id: 'p-1',
  platform: AIPlatform.ChatGPT,
  response_text: 'A'.repeat(300),
  brand_mentioned: true,
  brand_sentiment: BrandSentiment.Positive,
  brand_position: 1,
  domain_cited: true,
  cited_urls: ['https://acme.com/page'],
  competitor_mentions: [{ name: 'Rival', mentioned: true, cited: false }],
  cost_cents: 5,
  tokens_used: 100,
  queried_at: '2026-04-10T12:00:00Z',
  prompt_text: 'Best marketing tools',
  research_id: null,
  source: 'sync',
  insight: null,
  raw_response: null,
  created_at: '2026-04-10T12:00:00Z',
}

describe('MentionCard', () => {
  test('renders platform badge and prompt text', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
    expect(screen.getByText('Best marketing tools')).toBeInTheDocument()
  })

  test('renders sentiment and status badges', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('Positive')).toBeInTheDocument()
    expect(screen.getByText('Mentioned')).toBeInTheDocument()
    expect(screen.getByText('Cited')).toBeInTheDocument()
  })

  test('truncates long response text', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('Show more')).toBeInTheDocument()
  })

  test('expands response on click', async () => {
    const user = userEvent.setup()
    render(<MentionCard mention={baseMention} />)
    await user.click(screen.getByText('Show more'))
    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  test('renders competitor pills', () => {
    render(<MentionCard mention={baseMention} />)
    expect(screen.getByText('Rival')).toBeInTheDocument()
  })
})
