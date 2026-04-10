import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import {
  PlatformBadge,
  SentimentBadge,
  StatusChip,
  PositionBadge,
  CompetitorPills,
} from '@/components/ai-visibility/badges'

describe('PlatformBadge', () => {
  test('renders platform display name', () => {
    render(<PlatformBadge platform={AIPlatform.ChatGPT} />)
    expect(screen.getByText('ChatGPT')).toBeInTheDocument()
  })
})

describe('SentimentBadge', () => {
  test('renders sentiment label', () => {
    render(<SentimentBadge sentiment={BrandSentiment.Positive} />)
    expect(screen.getByText('Positive')).toBeInTheDocument()
  })

  test('renders negative sentiment', () => {
    render(<SentimentBadge sentiment={BrandSentiment.Negative} />)
    expect(screen.getByText('Negative')).toBeInTheDocument()
  })
})

describe('StatusChip', () => {
  test('renders positive chip with check icon', () => {
    render(<StatusChip positive={true} label="Mentioned" />)
    expect(screen.getByText('Mentioned')).toBeInTheDocument()
  })

  test('renders negative chip with x icon', () => {
    render(<StatusChip positive={false} label="Cited" />)
    expect(screen.getByText('Cited')).toBeInTheDocument()
  })
})

describe('PositionBadge', () => {
  test('renders position label', () => {
    render(<PositionBadge position={1} />)
    expect(screen.getByText(/1st third/)).toBeInTheDocument()
  })

  test('returns null for null position', () => {
    const { container } = render(<PositionBadge position={null} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('CompetitorPills', () => {
  test('renders competitor names', () => {
    render(
      <CompetitorPills
        competitors={[
          { name: 'Rival Co', mentioned: true, cited: false },
          { name: 'Other Inc', mentioned: false, cited: false },
        ]}
      />
    )
    expect(screen.getByText('Rival Co')).toBeInTheDocument()
    expect(screen.getByText('Other Inc')).toBeInTheDocument()
  })

  test('returns null for empty array', () => {
    const { container } = render(<CompetitorPills competitors={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
