import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { GaMetricTable } from '@/components/reviews/review-deck/ga-metric-table'
import type { GAData, MetricTriple } from '@/lib/reviews/types'

function makeTriple(overrides: Partial<MetricTriple> = {}): MetricTriple {
  return {
    current: 1000,
    qoq: 800,
    yoy: 700,
    qoq_delta_pct: 25,
    yoy_delta_pct: 42.8,
    ...overrides,
  }
}

describe('GaMetricTable', () => {
  test('returns null when data is undefined', () => {
    const { container } = render(<GaMetricTable data={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  test('returns null when no featured metrics are present', () => {
    const { container } = render(<GaMetricTable data={{}} />)
    expect(container.firstChild).toBeNull()
  })

  test('renders a table with four header columns: Metric, Current, QoQ, YoY', () => {
    const data: GAData = {
      ga_sessions: makeTriple(),
    }

    render(<GaMetricTable data={data} />)

    const table = screen.getByTestId('ga-metric-table')
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((h) => h.textContent)).toEqual(['Metric', 'Current', 'QoQ', 'YoY'])
  })

  test('renders one row per present featured metric in featured order', () => {
    const data: GAData = {
      ga_new_users: makeTriple({ current: 1500 }),
      ga_sessions: makeTriple({ current: 5000 }),
      ga_active_users: makeTriple({ current: 3000 }),
    }

    render(<GaMetricTable data={data} />)

    const table = screen.getByTestId('ga-metric-table')
    const tbody = table.querySelector('tbody')
    expect(tbody).not.toBeNull()
    const rows = within(tbody!).getAllByRole('row')
    expect(rows).toHaveLength(3)

    expect(within(rows[0]).getByText('Sessions')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Active users')).toBeInTheDocument()
    expect(within(rows[2]).getByText('New users')).toBeInTheDocument()
  })

  test('formats positive QoQ/YoY deltas with a leading + sign and one decimal', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 5000, qoq_delta_pct: 12.34, yoy_delta_pct: 8.1 }),
    }

    render(<GaMetricTable data={data} />)

    const row = screen.getByTestId('ga-metric-table').querySelector('tbody tr')!
    const cells = within(row as HTMLElement).getAllByRole('cell')
    // cells: Metric | Current | QoQ | YoY
    expect(cells[2].textContent).toBe('+12.3%')
    expect(cells[3].textContent).toBe('+8.1%')
  })

  test('formats negative QoQ/YoY deltas with a minus sign', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 5000, qoq_delta_pct: -4.56, yoy_delta_pct: -10 }),
    }

    render(<GaMetricTable data={data} />)

    const row = screen.getByTestId('ga-metric-table').querySelector('tbody tr')!
    const cells = within(row as HTMLElement).getAllByRole('cell')
    expect(cells[2].textContent).toBe('-4.6%')
    expect(cells[3].textContent).toBe('-10.0%')
  })

  test('renders em-dash for null qoq_delta_pct or yoy_delta_pct', () => {
    const data: GAData = {
      ga_sessions: makeTriple({
        current: 5000,
        qoq_delta_pct: null,
        yoy_delta_pct: null,
      }),
    }

    render(<GaMetricTable data={data} />)

    const row = screen.getByTestId('ga-metric-table').querySelector('tbody tr')!
    const cells = within(row as HTMLElement).getAllByRole('cell')
    expect(cells[2].textContent).toBe('\u2014')
    expect(cells[3].textContent).toBe('\u2014')
  })

  test('formats the current value with thousands separators for number metrics', () => {
    const data: GAData = {
      ga_sessions: makeTriple({ current: 12345 }),
    }

    render(<GaMetricTable data={data} />)

    const row = screen.getByTestId('ga-metric-table').querySelector('tbody tr')!
    const cells = within(row as HTMLElement).getAllByRole('cell')
    expect(cells[1].textContent).toBe('12,345')
  })
})
