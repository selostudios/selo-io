import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GaMetricStrip } from '@/components/reviews/review-deck/ga-metric-strip'
import type { GAData, MetricTriple } from '@/lib/reviews/types'

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

  test('renders label + value pairs for each present featured metric in featured order', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 5000 }),
      ga_active_users: makeTriple({ current: 3000 }),
      ga_new_users: makeTriple({ current: 1500 }),
    }

    render(<GaMetricStrip data={data} />)

    const strip = screen.getByTestId('ga-metric-strip')
    const labels = Array.from(strip.querySelectorAll('p:first-child')).map((n) => n.textContent)
    expect(labels).toEqual(['Sessions', 'Active users', 'New users'])
  })

  test('preserves featured order even when input data keys are in a different order', () => {
    const data: GAData = {
      ga_new_users: makeTriple({ current: 1500 }),
      ga_sessions: makeTriple({ current: 5000 }),
      ga_active_users: makeTriple({ current: 3000 }),
    }

    render(<GaMetricStrip data={data} />)

    const strip = screen.getByTestId('ga-metric-strip')
    const labels = Array.from(strip.querySelectorAll('p:first-child')).map((n) => n.textContent)
    expect(labels).toEqual(['Sessions', 'Active users', 'New users'])
  })

  test('skips missing metrics without rendering placeholders', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 5000 }),
      ga_new_users: makeTriple({ current: 1500 }),
    }

    render(<GaMetricStrip data={data} />)

    expect(screen.getByTestId('ga-metric-strip-item-ga_sessions')).toBeInTheDocument()
    expect(screen.getByTestId('ga-metric-strip-item-ga_new_users')).toBeInTheDocument()
    expect(screen.queryByTestId('ga-metric-strip-item-ga_active_users')).toBeNull()
  })

  test('formats current value with thousands separators for number metrics', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 12345 }),
    }

    render(<GaMetricStrip data={data} />)

    const item = screen.getByTestId('ga-metric-strip-item-ga_sessions')
    expect(item.textContent).toContain('12,345')
  })
})
