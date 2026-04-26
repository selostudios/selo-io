import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopPostCard } from '@/components/reviews/review-deck/top-post-card'
import type { LinkedInTopPost } from '@/lib/reviews/types'

const base: LinkedInTopPost = {
  id: 'urn:li:ugcPost:1',
  url: 'https://linkedin.com/feed/update/urn:li:ugcPost:1',
  thumbnail_url: null,
  caption: 'Great quarter of content',
  posted_at: '2026-02-01',
  impressions: 12345,
  reactions: 200,
  comments: 30,
  shares: 20,
  engagement_rate: 0.0203,
}

describe('TopPostCard', () => {
  test('renders caption, formatted engagement rate, impressions, and total engagements', () => {
    render(<TopPostCard post={base} />)
    expect(screen.getByText('Great quarter of content')).toBeInTheDocument()
    expect(screen.getByText('2.0%')).toBeInTheDocument()
    expect(screen.getByText(/12,345/)).toBeInTheDocument()
    expect(screen.getByText(/250/)).toBeInTheDocument() // 200 + 30 + 20
  })

  test('renders TextPostPlaceholder when thumbnail_url is null', () => {
    render(<TopPostCard post={base} />)
    expect(screen.getByTestId('text-post-placeholder')).toBeInTheDocument()
  })

  test('renders <img> when thumbnail_url is provided', () => {
    render(<TopPostCard post={{ ...base, thumbnail_url: 'https://example.com/t.jpg' }} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toContain(encodeURIComponent('https://example.com/t.jpg'))
  })
})
