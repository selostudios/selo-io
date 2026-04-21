import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GaMetricStrip } from '@/components/reviews/review-deck/ga-metric-strip'
import type { GAData, MetricTriple } from '@/lib/reviews/types'

vi.mock('@/components/dashboard/metric-card', () => ({
  MetricCard: (props: Record<string, unknown>) => (
    <div
      data-testid="mock-metric-card"
      data-label={props.label as string}
      data-value={String(props.value)}
      data-change={String(props.change)}
      data-has-timeseries={String(Boolean(props.timeSeries))}
      data-variant={props.variant as string}
    />
  ),
}))

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

describe('GaMetricStrip', () => {
  test('returns null when data is undefined', () => {
    const { container } = render(<GaMetricStrip data={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  test('returns null when data is empty (no featured triples present)', () => {
    const { container } = render(<GaMetricStrip data={{}} />)
    expect(container.firstChild).toBeNull()
  })

  test('returns null when data has only non-featured metrics', () => {
    const data: GAData = {
      ga_bounce_rate: makeTriple(),
    }
    const { container } = render(<GaMetricStrip data={data} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders one accent MetricCard per present featured metric in featured order', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 5000, qoq_delta_pct: 12.3 }),
      ga_active_users: makeTriple({ current: 3000, qoq_delta_pct: -4.5 }),
      ga_new_users: makeTriple({ current: 1500, qoq_delta_pct: 8.1 }),
    }

    render(<GaMetricStrip data={data} />)

    const cards = screen.getAllByTestId('mock-metric-card')
    expect(cards).toHaveLength(3)
    expect(cards[0].getAttribute('data-label')).toBe('Sessions')
    expect(cards[1].getAttribute('data-label')).toBe('Active users')
    expect(cards[2].getAttribute('data-label')).toBe('New users')

    cards.forEach((card) => {
      expect(card.getAttribute('data-variant')).toBe('accent')
      expect(card.getAttribute('data-has-timeseries')).toBe('true')
    })
  })

  test('preserves featured order even when input data keys are in a different order', () => {
    const data: GAData = {
      ga_new_users: makeTriple({ current: 1500 }),
      ga_sessions: makeTriple({ current: 5000 }),
      ga_active_users: makeTriple({ current: 3000 }),
    }

    render(<GaMetricStrip data={data} />)

    const cards = screen.getAllByTestId('mock-metric-card')
    expect(cards.map((c) => c.getAttribute('data-label'))).toEqual([
      'Sessions',
      'Active users',
      'New users',
    ])
  })

  test('skips missing metrics without rendering placeholders', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 5000 }),
      ga_new_users: makeTriple({ current: 1500 }),
    }

    render(<GaMetricStrip data={data} />)

    const cards = screen.getAllByTestId('mock-metric-card')
    expect(cards).toHaveLength(2)
    expect(cards.map((c) => c.getAttribute('data-label'))).toEqual(['Sessions', 'New users'])
  })

  test('renders card without timeseries when triple.timeseries is missing', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ timeseries: undefined }),
    }

    render(<GaMetricStrip data={data} />)

    const cards = screen.getAllByTestId('mock-metric-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].getAttribute('data-has-timeseries')).toBe('false')
  })

  test('passes qoq_delta_pct as change', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ qoq_delta_pct: 17.2 }),
    }

    render(<GaMetricStrip data={data} />)

    const card = screen.getByTestId('mock-metric-card')
    expect(card.getAttribute('data-change')).toBe('17.2')
  })

  test('formats current value with thousands separators for number metrics', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 12345 }),
    }

    render(<GaMetricStrip data={data} />)

    const card = screen.getByTestId('mock-metric-card')
    expect(card.getAttribute('data-value')).toBe('12,345')
  })
})
