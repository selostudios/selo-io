import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreCards } from '@/components/audit/score-cards'

describe('ScoreCards', () => {
  it('renders all four score cards', () => {
    render(<ScoreCards overall={72} seo={81} ai={58} technical={77} />)

    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText('77')).toBeInTheDocument()
  })

  it('renders all score labels', () => {
    render(<ScoreCards overall={72} seo={81} ai={58} technical={77} />)

    expect(screen.getByText('Overall')).toBeInTheDocument()
    expect(screen.getByText('SEO')).toBeInTheDocument()
    expect(screen.getByText('AI Readiness')).toBeInTheDocument()
    expect(screen.getByText('Technical')).toBeInTheDocument()
  })

  it('shows "-" for null scores', () => {
    render(<ScoreCards overall={null} seo={null} ai={null} technical={null} />)

    const dashes = screen.getAllByText('-')
    expect(dashes).toHaveLength(4)
  })

  it('shows "-" when individual scores are null', () => {
    render(<ScoreCards overall={50} seo={null} ai={75} technical={null} />)

    // Should show 2 numeric values and 2 dashes
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    const dashes = screen.getAllByText('-')
    expect(dashes).toHaveLength(2)
  })

  it('renders score values without /100 suffix', () => {
    render(<ScoreCards overall={72} seo={81} ai={58} technical={77} />)

    // ScoreCards display just the numeric score in the radial chart
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText('77')).toBeInTheDocument()
  })

  it('applies correct color classes based on score thresholds', () => {
    const { container } = render(
      <ScoreCards
        overall={85} // Green (70+)
        seo={55} // Yellow (40-69)
        ai={30} // Red (<40)
        technical={70} // Green (exactly 70)
      />
    )

    // Verify scores are rendered
    expect(container.textContent).toContain('85')
    expect(container.textContent).toContain('55')
    expect(container.textContent).toContain('30')
    expect(container.textContent).toContain('70')

    // Check for fill classes in the SVG chart text elements
    // Green scores (70+) should have fill-green-600
    expect(container.querySelector('.fill-green-600')).toBeInTheDocument()
    // Yellow scores (40-69) should have fill-yellow-700
    expect(container.querySelector('.fill-yellow-700')).toBeInTheDocument()
    // Red scores (<40) should have fill-red-600
    expect(container.querySelector('.fill-red-600')).toBeInTheDocument()
  })

  it('handles edge case scores correctly', () => {
    render(<ScoreCards overall={0} seo={100} ai={40} technical={69} />)

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.getByText('69')).toBeInTheDocument()
  })

  it('applies muted style for null scores', () => {
    const { container } = render(
      <ScoreCards overall={null} seo={null} ai={null} technical={null} />
    )

    // Null scores should have muted text color
    expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument()
  })
})
