import { describe, test, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ReviewDeck } from '@/components/reviews/review-deck'
import type {
  NarrativeBlocks,
  SnapshotData,
  GAData,
  LinkedInData,
  MetricTriple,
} from '@/lib/reviews/types'

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

  test('renders a seventh "What Resonated" slide when top_posts is non-empty', () => {
    renderDeck({
      narrative: { ...fullNarrative, content_highlights: 'Founder voice resonated.' },
      data: {
        linkedin: {
          metrics: {},
          top_posts: [
            {
              id: 'urn:li:ugcPost:1',
              url: null,
              thumbnail_url: null,
              caption: 'Specific post',
              posted_at: '2026-02-01',
              impressions: 1000,
              reactions: 20,
              comments: 5,
              shares: 5,
              engagement_rate: 0.03,
            },
          ],
        },
      },
    })
    const slides = screen.getAllByTestId('review-deck-slide')
    expect(slides).toHaveLength(7)
    expect(screen.getByRole('heading', { name: 'What Resonated' })).toBeInTheDocument()
  })

  test('omits the "What Resonated" slide when top_posts is empty or missing', () => {
    renderDeck({
      narrative: { ...fullNarrative, content_highlights: 'Should not appear.' },
      data: { linkedin: { metrics: {}, top_posts: [] } },
    })
    expect(screen.queryByRole('heading', { name: 'What Resonated' })).not.toBeInTheDocument()
    expect(screen.getAllByTestId('review-deck-slide')).toHaveLength(6)
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

    // The deck renders both a screen-only track and a print-only stacked copy, so
    // scope the query to the visible track to avoid matching the print duplicate.
    const track = screen.getByTestId('review-deck-track')
    const img = within(track).getByAltText(baseOrg.name) as HTMLImageElement
    expect(img).toBeInTheDocument()
    expect(img.src).toBe('https://cdn.example.com/acme.png')
  })

  test('omits the logo <img> when logo_url is null', () => {
    renderDeck({ organization: { ...baseOrg, logo_url: null } })

    const track = screen.getByTestId('review-deck-track')
    expect(within(track).queryByAltText(baseOrg.name)).toBeNull()
  })

  test('renders the placeholder text on a body slide whose block is empty', () => {
    renderDeck({
      narrative: { ...fullNarrative, ga_summary: '' },
    })

    const track = screen.getByTestId('review-deck-track')
    expect(within(track).getByText('No narrative available for this section')).toBeInTheDocument()
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

    const track = screen.getByTestId('review-deck-track')
    expect(within(track).queryByText('No narrative available for this section')).toBeNull()
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

// ---------------------------------------------------------------------------
// GA-specific routing tests
//
// The real BodySlide and GaBodySlide are stubbed here so we can assert which
// component ReviewDeck mounted for each section and which props it threaded.
// These tests live in a dedicated describe block with module-scoped doMocks
// and a dynamic import of ReviewDeck so the stubs don't leak into the top
// suite (which exercises the real slide components).
// ---------------------------------------------------------------------------
describe('ReviewDeck GA slide routing', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/components/reviews/review-deck/body-slide')
    vi.doUnmock('@/components/reviews/review-deck/ga-body-slide')
    vi.doUnmock('@/components/reviews/review-deck/linkedin-body-slide')
  })

  async function renderWithStubs(props: { narrative: NarrativeBlocks; data: SnapshotData }) {
    // Dynamic import of ReviewDeck resolves against the fresh module graph;
    // reset ensures the deck picks up the new stubs rather than reusing the
    // real slide components already cached from the top describe block.
    vi.resetModules()
    vi.doMock('@/components/reviews/review-deck/body-slide', () => ({
      BodySlide: ({ heading, text }: { heading: string; text: string }) => (
        <div data-testid="mock-body-slide" data-heading={heading} data-text={text}>
          mock-body-slide
        </div>
      ),
    }))
    vi.doMock('@/components/reviews/review-deck/ga-body-slide', () => ({
      GaBodySlide: ({
        narrative,
        data,
        mode,
      }: {
        narrative: string
        data: GAData | undefined
        mode: 'screen' | 'print'
      }) => (
        <div
          data-testid="mock-ga-body-slide"
          data-narrative={narrative}
          data-has-data={data === undefined ? 'false' : 'true'}
          data-mode={mode}
        >
          mock-ga-body-slide
        </div>
      ),
    }))
    vi.doMock('@/components/reviews/review-deck/linkedin-body-slide', () => ({
      LinkedInBodySlide: ({
        narrative,
        data,
        mode,
      }: {
        narrative: string
        data: LinkedInData | undefined
        mode: 'screen' | 'print'
      }) => (
        <div
          data-testid="mock-linkedin-body-slide"
          data-narrative={narrative}
          data-has-data={data === undefined ? 'false' : 'true'}
          data-mode={mode}
        >
          mock-linkedin-body-slide
        </div>
      ),
    }))

    const mod = await import('@/components/reviews/review-deck')
    return render(
      <mod.ReviewDeck
        organization={baseOrg}
        quarter="Q1 2026"
        periodStart="2026-01-01"
        periodEnd="2026-03-31"
        narrative={props.narrative}
        data={props.data}
      />
    )
  }

  const gaTriple: MetricTriple = {
    current: 1000,
    qoq: 800,
    yoy: 600,
    qoq_delta_pct: 0.25,
    yoy_delta_pct: 0.667,
  }
  const gaData: GAData = { ga_sessions: gaTriple }

  test('routes GA to GaBodySlide, LinkedIn to LinkedInBodySlide, and the rest to BodySlide', async () => {
    await renderWithStubs({
      narrative: fullNarrative,
      data: { ga: gaData, linkedin: undefined, hubspot: undefined },
    })

    // Two trees (screen-only and print-only) each render one GA and one LinkedIn slide.
    expect(screen.getAllByTestId('mock-ga-body-slide')).toHaveLength(2)
    expect(screen.getAllByTestId('mock-linkedin-body-slide')).toHaveLength(2)
    // And three BodySlide stubs per tree (initiatives + takeaways + planning) = 6.
    expect(screen.getAllByTestId('mock-body-slide')).toHaveLength(6)

    // The BodySlide stubs never carry the GA or LinkedIn heading.
    for (const node of screen.getAllByTestId('mock-body-slide')) {
      expect(node.getAttribute('data-heading')).not.toBe('Google Analytics')
      expect(node.getAttribute('data-heading')).not.toBe('LinkedIn')
    }
  })

  test('threads the ga sub-object into GaBodySlide as the data prop', async () => {
    await renderWithStubs({
      narrative: fullNarrative,
      data: { ga: gaData },
    })

    for (const node of screen.getAllByTestId('mock-ga-body-slide')) {
      // We don't serialize the full object through data-*; the stub records
      // presence. The important guarantee is that data was threaded (not
      // undefined) when the caller supplied it.
      expect(node.getAttribute('data-has-data')).toBe('true')
      expect(node.getAttribute('data-narrative')).toBe(fullNarrative.ga_summary)
    }
  })

  test('screen branch renders GaBodySlide with mode=screen; print branch with mode=print', async () => {
    const { container } = await renderWithStubs({
      narrative: fullNarrative,
      data: { ga: gaData },
    })

    const screenBranch = container.querySelector('.screen-only') as HTMLElement
    const printBranch = container.querySelector('.print-only') as HTMLElement
    expect(screenBranch).not.toBeNull()
    expect(printBranch).not.toBeNull()

    const screenGa = within(screenBranch).getByTestId('mock-ga-body-slide')
    expect(screenGa.getAttribute('data-mode')).toBe('screen')

    const printGa = within(printBranch).getByTestId('mock-ga-body-slide')
    expect(printGa.getAttribute('data-mode')).toBe('print')
  })

  test('still mounts GaBodySlide with data=undefined when the ga sub-object is missing', async () => {
    await renderWithStubs({
      narrative: fullNarrative,
      data: {}, // no ga key — slide must still render so the deck count stays at 6
    })

    const stubs = screen.getAllByTestId('mock-ga-body-slide')
    expect(stubs).toHaveLength(2)
    for (const node of stubs) {
      expect(node.getAttribute('data-has-data')).toBe('false')
      // Narrative is still threaded from the NarrativeBlocks argument.
      expect(node.getAttribute('data-narrative')).toBe(fullNarrative.ga_summary)
    }
  })

  test('BodySlide receives an empty string (not undefined) when a narrative block is missing', async () => {
    await renderWithStubs({
      narrative: { ...fullNarrative, initiatives: undefined },
      data: { ga: gaData },
    })

    const bodyStubs = screen.getAllByTestId('mock-body-slide')
    const initiativesStub = bodyStubs.find((n) => n.getAttribute('data-heading') === 'Initiatives')
    expect(initiativesStub).toBeDefined()
    expect(initiativesStub?.getAttribute('data-text')).toBe('')
  })

  test('LinkedInBodySlide receives an empty string when linkedin_insights is missing', async () => {
    await renderWithStubs({
      narrative: { ...fullNarrative, linkedin_insights: undefined },
      data: {},
    })

    const stubs = screen.getAllByTestId('mock-linkedin-body-slide')
    expect(stubs).toHaveLength(2)
    for (const node of stubs) {
      expect(node.getAttribute('data-narrative')).toBe('')
      expect(node.getAttribute('data-has-data')).toBe('false')
    }
  })

  test('threads the linkedin sub-object into LinkedInBodySlide as the data prop', async () => {
    const linkedinData: LinkedInData = { metrics: {}, top_posts: [] }
    await renderWithStubs({
      narrative: fullNarrative,
      data: { linkedin: linkedinData },
    })

    for (const node of screen.getAllByTestId('mock-linkedin-body-slide')) {
      expect(node.getAttribute('data-has-data')).toBe('true')
      expect(node.getAttribute('data-narrative')).toBe(fullNarrative.linkedin_insights)
    }
  })
})
