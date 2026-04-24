import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkedInMetricStrip } from '@/components/reviews/review-deck/linkedin-metric-strip'
import type { LinkedInData, MetricTriple } from '@/lib/reviews/types'

function makeTriple(overrides: Partial<MetricTriple> = {}): MetricTriple {
  return {
    current: 1000,
    qoq: 800,
    yoy: 700,
    qoq_delta_pct: 25,
    yoy_delta_pct: 42.8,
    timeseries: {
      current: [
        { date: '2026-01-01', value: 100 },
        { date: '2026-01-02', value: 200 },
      ],
      qoq: [
        { date: '2025-10-01', value: 90 },
        { date: '2025-10-02', value: 150 },
      ],
      yoy: [
        { date: '2025-01-01', value: 80 },
        { date: '2025-01-02', value: 120 },
      ],
    },
    ...overrides,
  }
}

function makeData(metrics: Record<string, MetricTriple>): LinkedInData {
  return { metrics, top_posts: [] }
}

describe('LinkedInMetricStrip', () => {
  test('returns null when data is undefined', () => {
    const { container } = render(<LinkedInMetricStrip data={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  test('returns null when data has no featured triples', () => {
    const { container } = render(<LinkedInMetricStrip data={makeData({})} />)
    expect(container.firstChild).toBeNull()
  })

  test('returns null when data has only non-featured metrics', () => {
    const data = makeData({ linkedin_reactions: makeTriple() })
    const { container } = render(<LinkedInMetricStrip data={data} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders label + value pairs in featured order', () => {
    const data = makeData({
      linkedin_impressions: makeTriple({ current: 10000 }),
      linkedin_follower_growth: makeTriple({ current: 50 }),
      linkedin_page_views: makeTriple({ current: 500 }),
    })

    render(<LinkedInMetricStrip data={data} />)

    const strip = screen.getByTestId('linkedin-metric-strip')
    const labels = Array.from(strip.querySelectorAll('p:first-child')).map((n) => n.textContent)
    expect(labels).toEqual(['Impressions', 'New followers', 'Page views'])
  })

  test('preserves featured order regardless of input key order', () => {
    const data = makeData({
      linkedin_page_views: makeTriple({ current: 500 }),
      linkedin_impressions: makeTriple({ current: 10000 }),
      linkedin_follower_growth: makeTriple({ current: 50 }),
    })

    render(<LinkedInMetricStrip data={data} />)

    const strip = screen.getByTestId('linkedin-metric-strip')
    const labels = Array.from(strip.querySelectorAll('p:first-child')).map((n) => n.textContent)
    expect(labels).toEqual(['Impressions', 'New followers', 'Page views'])
  })

  test('skips missing metrics without placeholders', () => {
    const data = makeData({
      linkedin_impressions: makeTriple({ current: 10000 }),
      linkedin_page_views: makeTriple({ current: 500 }),
    })

    render(<LinkedInMetricStrip data={data} />)

    expect(
      screen.getByTestId('linkedin-metric-strip-item-linkedin_impressions')
    ).toBeInTheDocument()
    expect(screen.getByTestId('linkedin-metric-strip-item-linkedin_page_views')).toBeInTheDocument()
    expect(screen.queryByTestId('linkedin-metric-strip-item-linkedin_follower_growth')).toBeNull()
  })

  test('formats current value with thousands separators for number metrics', () => {
    const data = makeData({
      linkedin_impressions: makeTriple({ current: 12345 }),
    })

    render(<LinkedInMetricStrip data={data} />)

    const item = screen.getByTestId('linkedin-metric-strip-item-linkedin_impressions')
    expect(item.textContent).toContain('12,345')
  })
})
