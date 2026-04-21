import { describe, test, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ReviewDeck } from '@/components/reviews/review-deck'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

const baseOrg = {
  name: 'Acme Corp',
  logo_url: null as string | null,
  primary_color: null as string | null,
}

const fullNarrative: NarrativeBlocks = {
  cover_subtitle: 'A strong start to the year',
  ga_summary: 'Traffic grew 18% compared to last quarter.',
  linkedin_insights: 'Engagement rate is up meaningfully.',
  initiatives: 'Launched a new campaign focused on enterprise leads.',
  takeaways: '- Brand search doubled\n- Email CTR improved',
  planning: 'Double down on product-led content next quarter.',
}

const emptyData: SnapshotData = {}

function renderDeck(overrides: Partial<Parameters<typeof ReviewDeck>[0]> = {}) {
  return render(
    <ReviewDeck
      organization={baseOrg}
      quarter="Q1 2026"
      periodStart="2026-01-01"
      periodEnd="2026-03-31"
      narrative={fullNarrative}
      data={emptyData}
      {...overrides}
    />
  )
}

describe('ReviewDeck', () => {
  test('renders exactly six slide sections', () => {
    renderDeck()

    const slides = screen.getAllByTestId('review-deck-slide')
    expect(slides).toHaveLength(6)
  })

  test('sets the --deck-accent CSS variable to the organization primary color', () => {
    renderDeck({
      organization: { ...baseOrg, primary_color: '#336699' },
    })

    const root = screen.getByTestId('review-deck')
    // happy-dom lowercases custom property names consistently.
    expect(root.style.getPropertyValue('--deck-accent')).toBe('#336699')
  })

  test('falls back to var(--foreground) for --deck-accent when primary_color is null', () => {
    renderDeck({
      organization: { ...baseOrg, primary_color: null },
    })

    const root = screen.getByTestId('review-deck')
    expect(root.style.getPropertyValue('--deck-accent')).toBe('var(--foreground)')
  })

  test('renders an <img> with the org name alt when logo_url is provided', () => {
    renderDeck({
      organization: { ...baseOrg, logo_url: 'https://cdn.example.com/acme.png' },
    })

    const img = screen.getByAltText(baseOrg.name) as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe('https://cdn.example.com/acme.png')
  })

  test('omits the logo <img> when logo_url is null', () => {
    renderDeck({ organization: { ...baseOrg, logo_url: null } })

    expect(screen.queryByAltText(baseOrg.name)).toBeNull()
  })

  test('renders the placeholder text on a body slide whose block is empty', () => {
    renderDeck({
      narrative: { ...fullNarrative, ga_summary: '' },
    })

    expect(screen.getByText('No narrative available for this section')).toBeInTheDocument()
  })

  test('does not render the placeholder on the cover slide when cover_subtitle is empty', () => {
    renderDeck({
      narrative: {
        // All body blocks populated so the placeholder cannot come from a body slide.
        ga_summary: 'Traffic grew 18% compared to last quarter.',
        linkedin_insights: 'Engagement rate is up meaningfully.',
        initiatives: 'Launched a new campaign focused on enterprise leads.',
        takeaways: 'Strong quarter overall.',
        planning: 'Double down on product-led content next quarter.',
        // cover_subtitle omitted
      },
    })

    expect(screen.queryByText('No narrative available for this section')).toBeNull()
  })

  test('advances to slide index 1 when the Next button is clicked', () => {
    renderDeck()

    const track = screen.getByTestId('review-deck-track')
    expect(track.getAttribute('data-current-index')).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: /next slide/i }))

    expect(track.getAttribute('data-current-index')).toBe('1')
  })

  test('advances to slide index 1 when ArrowRight is pressed (hook integration)', () => {
    renderDeck()

    const track = screen.getByTestId('review-deck-track')
    expect(track.getAttribute('data-current-index')).toBe('0')

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(track.getAttribute('data-current-index')).toBe('1')
  })

  test('each body slide exposes its heading through its aria-label', () => {
    renderDeck()

    const slides = screen.getAllByTestId('review-deck-slide')
    // slides[1] is the first body slide (Google Analytics)
    expect(slides[1].getAttribute('aria-label')).toContain('Google Analytics')
    // Heading should also be present in the DOM for the GA slide.
    expect(within(slides[1]).getByRole('heading', { name: 'Google Analytics' })).toBeInTheDocument()
  })

  test('space key advances exactly one slide when the Next button is focused', () => {
    renderDeck()

    const track = screen.getByTestId('review-deck-track')
    expect(track.getAttribute('data-current-index')).toBe('0')

    const nextButton = screen.getByRole('button', { name: /next slide/i }) as HTMLButtonElement
    nextButton.focus()
    expect(document.activeElement).toBe(nextButton)

    // The global keydown listener lives on window; dispatch there to mirror
    // real browser bubbling. If the hook doesn't preventDefault, the button's
    // native Space→click synthesis would advance a second time.
    fireEvent.keyDown(window, { key: ' ' })

    expect(track.getAttribute('data-current-index')).toBe('1')
  })

  test('announces the current slide heading through the live region', () => {
    renderDeck()

    const liveRegion = screen.getByTestId('review-deck-live-region')
    expect(liveRegion.getAttribute('aria-live')).toBe('polite')
    expect(liveRegion.textContent).toBe('Slide 1 of 6: Quarterly Performance Review')

    fireEvent.click(screen.getByRole('button', { name: /next slide/i }))

    expect(liveRegion.textContent).toBe('Slide 2 of 6: Google Analytics')
  })
})
