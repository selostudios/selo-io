import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResearchResultCard } from '@/components/ai-visibility/research-result-card'
import { AIPlatform, BrandSentiment } from '@/lib/enums'

const baseResult = {
  id: '1',
  organization_id: 'org-1',
  platform: AIPlatform.ChatGPT,
  response_text: 'Here are the best marketing tools for small businesses...',
  brand_mentioned: true,
  brand_sentiment: BrandSentiment.Positive,
  brand_position: 1,
  domain_cited: true,
  cited_urls: ['https://acme.com'],
  competitor_mentions: [{ name: 'Rival', mentioned: true, cited: false }],
  insight: 'Your brand is well-positioned. Keep producing comparison content.',
  cost_cents: 5,
  queried_at: '2026-04-10T12:00:00Z',
}

describe('ResearchResultCard', () => {
  test('renders platform name', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText('ChatGPT')).toBeDefined()
  })

  test('shows mentioned badge when brand is mentioned', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText('Mentioned')).toBeDefined()
  })

  test('shows not mentioned badge when brand is absent', () => {
    render(
      <ResearchResultCard result={{ ...baseResult, brand_mentioned: false, brand_position: null }} />
    )
    expect(screen.getByText('Not mentioned')).toBeDefined()
  })

  test('shows insight section when insight is present', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText(/well-positioned/)).toBeDefined()
  })

  test('hides insight section when insight is null', () => {
    render(<ResearchResultCard result={{ ...baseResult, insight: null }} />)
    expect(screen.queryByTestId('research-insight')).toBeNull()
  })

  test('shows sentiment badge', () => {
    render(<ResearchResultCard result={baseResult} />)
    expect(screen.getByText('Positive')).toBeDefined()
  })

  test('shows save to monitoring button', () => {
    render(<ResearchResultCard result={baseResult} onSaveToMonitoring={() => {}} />)
    expect(screen.getByText('Save to monitoring')).toBeDefined()
  })
})
