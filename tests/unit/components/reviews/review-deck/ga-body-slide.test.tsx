import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { GaBodySlide } from '@/components/reviews/review-deck/ga-body-slide'
import type { GAData, MetricTriple } from '@/lib/reviews/types'

vi.mock('@/components/reviews/review-deck/ga-metric-strip', () => ({
  GaMetricStrip: (props: { data: GAData | undefined }) => (
    <div
      data-testid="mock-ga-metric-strip"
      data-has-data={String(props.data !== undefined)}
      data-data-keys={props.data ? Object.keys(props.data).join(',') : ''}
    />
  ),
}))

vi.mock('@/components/reviews/review-deck/ga-metric-table', () => ({
  GaMetricTable: (props: { data: GAData | undefined }) => (
    <div
      data-testid="mock-ga-metric-table"
      data-has-data={String(props.data !== undefined)}
      data-data-keys={props.data ? Object.keys(props.data).join(',') : ''}
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
    ...overrides,
  }
}

describe('GaBodySlide', () => {
  test('renders the metric strip and not the table in screen mode', () => {
    const data: GAData = { ga_sessions: makeTriple() }

    render(<GaBodySlide narrative="Some narrative." data={data} mode="screen" />)

    expect(screen.getByTestId('mock-ga-metric-strip')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-ga-metric-table')).not.toBeInTheDocument()
  })

  test('renders the metric table and not the strip in print mode', () => {
    const data: GAData = { ga_sessions: makeTriple() }

    render(<GaBodySlide narrative="Some narrative." data={data} mode="print" />)

    expect(screen.getByTestId('mock-ga-metric-table')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-ga-metric-strip')).not.toBeInTheDocument()
  })

  test('renders the narrative text in screen mode', () => {
    const data: GAData = { ga_sessions: makeTriple() }

    render(
      <GaBodySlide narrative="Traffic grew meaningfully this quarter." data={data} mode="screen" />
    )

    expect(screen.getByText('Traffic grew meaningfully this quarter.')).toBeInTheDocument()
  })

  test('renders the narrative text in print mode', () => {
    const data: GAData = { ga_sessions: makeTriple() }

    render(
      <GaBodySlide narrative="Traffic grew meaningfully this quarter." data={data} mode="print" />
    )

    expect(screen.getByText('Traffic grew meaningfully this quarter.')).toBeInTheDocument()
  })

  test('threads undefined data through to the strip stub without short-circuiting', () => {
    render(<GaBodySlide narrative="Narrative with no data." data={undefined} mode="screen" />)

    const strip = screen.getByTestId('mock-ga-metric-strip')
    expect(strip.getAttribute('data-has-data')).toBe('false')
    expect(screen.queryByTestId('mock-ga-metric-table')).not.toBeInTheDocument()
  })

  test('threads undefined data through to the table stub without short-circuiting', () => {
    render(<GaBodySlide narrative="Narrative with no data." data={undefined} mode="print" />)

    const table = screen.getByTestId('mock-ga-metric-table')
    expect(table.getAttribute('data-has-data')).toBe('false')
    expect(screen.queryByTestId('mock-ga-metric-strip')).not.toBeInTheDocument()
  })

  test('renders the empty narrative placeholder when narrative is an empty string', () => {
    const data: GAData = { ga_sessions: makeTriple() }

    render(<GaBodySlide narrative="" data={data} mode="screen" />)

    expect(screen.getByText('No narrative available for this section')).toBeInTheDocument()
    // Strip still renders when data is present.
    expect(screen.getByTestId('mock-ga-metric-strip')).toBeInTheDocument()
  })

  test('renders the empty narrative placeholder when narrative is whitespace-only', () => {
    const data: GAData = { ga_sessions: makeTriple() }

    render(<GaBodySlide narrative={'   \n\t  \n  '} data={data} mode="print" />)

    expect(screen.getByText('No narrative available for this section')).toBeInTheDocument()
    // Table still renders when data is present.
    expect(screen.getByTestId('mock-ga-metric-table')).toBeInTheDocument()
  })

  test('uses "Google Analytics" as the heading text', () => {
    render(<GaBodySlide narrative="Summary text." data={undefined} mode="screen" />)

    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Google Analytics')
    expect(heading.textContent).toBe('Google Analytics')
  })

  test('parses bullet lines in the narrative into a <ul> with one <li> per bullet', () => {
    const narrative = 'Intro paragraph\n- first point\n- second point'

    const { container } = render(
      <GaBodySlide narrative={narrative} data={undefined} mode="screen" />
    )

    const content = container.querySelector('[data-testid="ga-body-slide-content"]')
    expect(content).not.toBeNull()

    const list = content!.querySelector('ul')
    expect(list).not.toBeNull()

    const items = within(list as HTMLElement).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('first point')
    expect(items[1]).toHaveTextContent('second point')

    // Intro paragraph still renders as a <p>.
    const paragraphs = content!.querySelectorAll('p')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]).toHaveTextContent('Intro paragraph')
  })
})
