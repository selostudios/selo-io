import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReviewDeck } from '@/components/reviews/review-deck'
import { SLIDES } from '@/lib/reviews/slides/registry'
import { sampleOrg, sampleNarrative, sampleSnapshotData } from '@/tests/helpers/reviews-fixtures'

function renderDeck(overrides: Partial<Parameters<typeof ReviewDeck>[0]> = {}) {
  return render(
    <ReviewDeck
      organization={sampleOrg}
      quarter="Q1 2026"
      periodStart="2026-01-01"
      periodEnd="2026-03-31"
      narrative={sampleNarrative}
      data={sampleSnapshotData}
      {...overrides}
    />
  )
}

describe('ReviewDeck mode prop', () => {
  test('presentation mode (default) filters out keys in hiddenSlides', () => {
    renderDeck({ hiddenSlides: ['ga_summary'] })

    expect(screen.queryByLabelText(/Google Analytics/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/LinkedIn/)).toBeInTheDocument()
  })

  test('presentation mode drops every hideable slide listed in hiddenSlides', () => {
    renderDeck({ hiddenSlides: ['ga_summary', 'linkedin_insights', 'planning'] })

    const track = screen.getByTestId('review-deck-track')
    expect(track.children).toHaveLength(SLIDES.length - 3)
    expect(screen.queryByLabelText(/Google Analytics/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/LinkedIn/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Planning Ahead/)).not.toBeInTheDocument()
  })

  test('editor mode keeps hidden slides but renders Hidden badge', () => {
    renderDeck({ hiddenSlides: ['ga_summary'], mode: 'editor' })

    const ga = screen.getByLabelText(/Google Analytics/)
    expect(ga).toBeInTheDocument()
    expect(within(ga).getByText(/Hidden/i)).toBeInTheDocument()
  })

  test('initialSlideKey starts the deck on the requested slide', () => {
    renderDeck({ mode: 'editor', initialSlideKey: 'initiatives' })

    const track = screen.getByTestId('review-deck-track')
    // Editor mode renders all registry slides:
    // cover=0, ga_summary=1, linkedin_insights=2, content_highlights=3, initiatives=4
    expect(track.getAttribute('data-current-index')).toBe('4')
  })

  test('content_highlights is auto-hidden in presentation mode when posts is empty', () => {
    renderDeck({
      data: { ...sampleSnapshotData, linkedin: { metrics: {}, top_posts: [] } },
    })

    expect(screen.queryByLabelText(/What Resonated/)).not.toBeInTheDocument()
  })

  test('content_highlights is shown in editor mode even when posts is empty', () => {
    renderDeck({
      mode: 'editor',
      data: { ...sampleSnapshotData, linkedin: { metrics: {}, top_posts: [] } },
    })

    expect(screen.getByLabelText(/What Resonated/)).toBeInTheDocument()
  })
})
