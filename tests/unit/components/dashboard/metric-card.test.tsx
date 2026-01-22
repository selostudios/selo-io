import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricCard } from '@/components/dashboard/metric-card'

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
})
