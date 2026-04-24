import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopPostGrid } from '@/components/reviews/review-deck/top-post-grid'

const makePost = (n: number) => ({
  id: `urn:li:ugcPost:${n}`,
  url: null,
  thumbnail_url: null,
  caption: `Post ${n}`,
  posted_at: '2026-02-01',
  impressions: 1000,
  reactions: 20,
  comments: 5,
  shares: 5,
  engagement_rate: 0.03,
})

describe('TopPostGrid', () => {
  test('renders one card per post', () => {
    render(<TopPostGrid posts={[makePost(1), makePost(2), makePost(3), makePost(4)]} />)
    expect(screen.getAllByTestId('top-post-card')).toHaveLength(4)
  })

  test('renders fewer than 4 centered', () => {
    render(<TopPostGrid posts={[makePost(1), makePost(2)]} />)
    expect(screen.getAllByTestId('top-post-card')).toHaveLength(2)
    const grid = screen.getByTestId('top-post-grid')
    expect(grid.className).toMatch(/justify-center/)
  })

  test('returns null when posts is empty', () => {
    const { container } = render(<TopPostGrid posts={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
