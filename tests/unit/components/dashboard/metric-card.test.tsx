import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard, GRADIENT_STOPS } from '@/components/dashboard/metric-card'

describe('MetricCard', () => {
  it('should render value and label', () => {
    render(<MetricCard label="Followers" value={220} change={null} />)

    expect(screen.getByText('220')).toBeInTheDocument()
    expect(screen.getByText('Followers')).toBeInTheDocument()
  })

  it('should format large numbers with commas', () => {
    render(<MetricCard label="Impressions" value={2976} change={13.5} />)

    expect(screen.getByText('2,976')).toBeInTheDocument()
  })

  it('should show positive change in green with up arrow', () => {
    const { container } = render(<MetricCard label="Followers" value={220} change={746.2} />)

    const changeElement = screen.getByText(/746.2%/)
    expect(changeElement).toHaveClass('text-green-600')
    // Check for TrendingUp icon (SVG with lucide-trending-up class)
    expect(container.querySelector('.lucide-trending-up')).toBeInTheDocument()
  })

  it('should show negative change in red with down arrow', () => {
    const { container } = render(<MetricCard label="Reactions" value={53} change={-35.4} />)

    const changeElement = screen.getByText(/35.4%/)
    expect(changeElement).toHaveClass('text-red-600')
    // Check for TrendingDown icon (SVG with lucide-trending-down class)
    expect(container.querySelector('.lucide-trending-down')).toBeInTheDocument()
  })

  it('should not show change when null', () => {
    const { container } = render(<MetricCard label="Followers" value={220} change={null} />)

    expect(container.querySelector('.lucide-trending-up')).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-trending-down')).not.toBeInTheDocument()
  })

  describe('chart color variant', () => {
    const timeSeries = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 120 },
      { date: '2026-01-03', value: 140 },
    ]

    function getChartStyleCss(container: HTMLElement): string {
      // ChartContainer renders a <style> child inside [data-slot="chart"] that
      // defines `--color-value: <color>;` — that's what drives the sparkline
      // stroke and gradient base color.
      const chartEl = container.querySelector('[data-slot="chart"]')
      const styleEl = chartEl?.querySelector('style')
      return styleEl?.innerHTML ?? ''
    }

    it('uses the brand indigo token for the sparkline when variant is accent', () => {
      const { container } = render(
        <MetricCard
          label="Sessions"
          value={1234}
          change={5.2}
          timeSeries={timeSeries}
          variant="accent"
        />
      )

      const css = getChartStyleCss(container)
      expect(css).toContain('--color-value: var(--color-indigo-500)')
      expect(css).not.toContain('hsl(var(--primary))')
    })

    it('keeps the default primary color for the sparkline when no variant is passed', () => {
      const { container } = render(
        <MetricCard label="Sessions" value={1234} change={5.2} timeSeries={timeSeries} />
      )

      const css = getChartStyleCss(container)
      expect(css).toContain('--color-value: hsl(var(--primary))')
      expect(css).not.toContain('var(--color-indigo-500)')
    })

    it('pins the accent gradient to brand indigo-500 (top) and purple-600 (bottom)', () => {
      const [top, bottom] = GRADIENT_STOPS.accent
      expect(top).toEqual({
        offset: '5%',
        stopColor: 'var(--color-indigo-500)',
        stopOpacity: 0.3,
      })
      expect(bottom).toEqual({
        offset: '95%',
        stopColor: 'var(--color-purple-600)',
        stopOpacity: 0.05,
      })
    })

    it('keeps the default gradient on the chart-config --color-value token', () => {
      const [top, bottom] = GRADIENT_STOPS.default
      expect(top.stopColor).toBe('var(--color-value)')
      expect(bottom.stopColor).toBe('var(--color-value)')
    })
  })
})
