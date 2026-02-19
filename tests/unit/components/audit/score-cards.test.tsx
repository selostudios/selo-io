import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreCards } from '@/components/audit/score-cards'

describe('ScoreCards', () => {
  it('renders all three score cards', () => {
    render(<ScoreCards overall={72} seo={81} technical={77} />)

    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
    expect(screen.getByText('77')).toBeInTheDocument()
  })

  it('renders all score labels', () => {
    render(<ScoreCards overall={72} seo={81} technical={77} />)

    expect(screen.getByText('Overall')).toBeInTheDocument()
    expect(screen.getByText('SEO')).toBeInTheDocument()
    expect(screen.getByText('Technical')).toBeInTheDocument()
  })

  it('shows "-" for null scores', () => {
    render(<ScoreCards overall={null} seo={null} technical={null} />)

    const dashes = screen.getAllByText('-')
    expect(dashes).toHaveLength(3)
  })

  it('shows "-" when individual scores are null', () => {
    render(<ScoreCards overall={50} seo={null} technical={null} />)

    // Should show 1 numeric value and 2 dashes
    expect(screen.getByText('50')).toBeInTheDocument()
    const dashes = screen.getAllByText('-')
    expect(dashes).toHaveLength(2)
  })

  it('renders score values without /100 suffix', () => {
    render(<ScoreCards overall={72} seo={81} technical={77} />)

    // ScoreCards display just the numeric score in the radial chart
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
    expect(screen.getByText('77')).toBeInTheDocument()
  })

  it('applies correct color classes based on score thresholds', () => {
    const { container } = render(
      <ScoreCards
        overall={85} // Green (80+)
        seo={70} // Yellow (60-79)
        technical={80} // Green (exactly 80)
      />
    )

    // Verify scores are rendered
    expect(container.textContent).toContain('85')
    expect(container.textContent).toContain('70')
    expect(container.textContent).toContain('80')

    // Check for fill classes in the SVG chart text elements
    // Green scores (80+) should have fill-green-600
    expect(container.querySelector('.fill-green-600')).toBeInTheDocument()
    // Yellow scores (60-79) should have fill-yellow-700
    expect(container.querySelector('.fill-yellow-700')).toBeInTheDocument()
  })

  it('handles edge case scores correctly', () => {
    render(<ScoreCards overall={0} seo={100} technical={79} />)

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('79')).toBeInTheDocument()
  })

  it('applies muted style for null scores', () => {
    const { container } = render(<ScoreCards overall={null} seo={null} technical={null} />)

    // Null scores should have muted text color
    expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument()
  })
})
