import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentBodySlide } from '@/components/reviews/review-deck/content-body-slide'

describe('ContentBodySlide', () => {
  test('renders heading, grid, and narrative', () => {
    render(
      <ContentBodySlide
        narrative="These posts worked because they were specific."
        posts={[
          {
            id: 'urn:li:ugcPost:1',
            url: null,
            thumbnail_url: null,
            caption: 'Specific post',
            posted_at: '2026-02-01',
            impressions: 1000,
            reactions: 20,
            comments: 5,
            shares: 5,
            engagement_rate: 0.03,
          },
        ]}
        mode="screen"
      />
    )
    expect(screen.getByRole('heading', { name: 'What Resonated' })).toBeInTheDocument()
    expect(screen.getByTestId('top-post-grid')).toBeInTheDocument()
    expect(screen.getByTestId('content-body-slide-content')).toHaveTextContent(
      'These posts worked because they were specific.'
    )
  })
})
