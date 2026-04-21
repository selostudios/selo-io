'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CSSProperties } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { useDeckNavigation } from '@/components/deck/use-deck-navigation'
import { Slide } from '@/components/deck/slide'
import { DeckControls } from '@/components/deck/deck-controls'
import { getFullscreenElement, toggleElementFullscreen } from '@/components/deck/fullscreen'
import { DeckPrintStyles } from '@/components/deck/print-styles'
import { CoverSlide } from './cover-slide'
import { BodySlide } from './body-slide'
import { GaBodySlide } from './ga-body-slide'

export interface ReviewDeckProps {
  organization: {
    name: string
    logo_url: string | null
    primary_color: string | null
  }
  quarter: string
  /** ISO date string, e.g. '2026-01-01' */
  periodStart: string
  /** ISO date string, e.g. '2026-03-31' */
  periodEnd: string
  narrative: NarrativeBlocks
  /** Snapshot metric data. Currently only `data.ga` is consumed (by the GA slide's metric strip / table). */
  data: SnapshotData
}

/**
 * Tagged union describing a body slide definition. `kind: 'ga'` routes to
 * `GaBodySlide` (metric strip + narrative); `kind: 'default'` routes to
 * `BodySlide` (heading + narrative). Narrow at the definition layer so the
 * render pass stays a pure switch without touching BodySlide's stable API.
 */
type BodySection =
  | {
      key: Exclude<keyof NarrativeBlocks, 'cover_subtitle' | 'ga_summary'>
      heading: string
      kind: 'default'
    }
  | { key: 'ga_summary'; heading: string; kind: 'ga' }

const BODY_SECTIONS: readonly BodySection[] = [
  { key: 'ga_summary', heading: 'Google Analytics', kind: 'ga' },
  { key: 'linkedin_insights', heading: 'LinkedIn', kind: 'default' },
  { key: 'initiatives', heading: 'Initiatives', kind: 'default' },
  { key: 'takeaways', heading: 'Takeaways', kind: 'default' },
  { key: 'planning', heading: 'Planning Ahead', kind: 'default' },
]

/**
 * Each slide knows how to render itself for a given output surface. The
 * deck emits two subtrees — `.screen-only` (carousel) and `.print-only`
 * (stacked) — and calls `render('screen')` / `render('print')` respectively.
 * Non-GA slides ignore the mode and return the same node for both surfaces;
 * the GA slide swaps a live metric strip for a compact text table in print.
 */
interface BuiltSlide {
  key: string
  ariaHeading: string
  render: (mode: 'screen' | 'print') => ReactNode
}

/**
 * `<ReviewDeck>` is the shared renderer used by the editor preview, the
 * snapshot detail page, and the public share page. It produces a fixed
 * 6-slide deck: cover + Google Analytics + LinkedIn + Initiatives +
 * Takeaways + Planning Ahead. Missing narrative blocks render a muted
 * placeholder on body slides so the deck count stays consistent.
 */
export function ReviewDeck({
  organization,
  quarter,
  periodStart,
  periodEnd,
  narrative,
  data,
}: ReviewDeckProps) {
  const deckRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const slides: BuiltSlide[] = useMemo(() => {
    const coverRender = (
      <CoverSlide
        organization={{ name: organization.name, logo_url: organization.logo_url }}
        quarter={quarter}
        periodStart={periodStart}
        periodEnd={periodEnd}
        subtitle={narrative.cover_subtitle}
      />
    )

    const bodySlides: BuiltSlide[] = BODY_SECTIONS.map((section) => {
      const text = narrative[section.key] ?? ''
      if (section.kind === 'ga') {
        return {
          key: section.key,
          ariaHeading: section.heading,
          render: (mode: 'screen' | 'print') => (
            <GaBodySlide narrative={text} data={data?.ga} mode={mode} />
          ),
        }
      }
      return {
        key: section.key,
        ariaHeading: section.heading,
        render: () => <BodySlide heading={section.heading} text={text} />,
      }
    })

    return [
      {
        key: 'cover',
        ariaHeading: 'Quarterly Performance Review',
        render: () => coverRender,
      },
      ...bodySlides,
    ]
  }, [organization, quarter, periodStart, periodEnd, narrative, data])

  const { currentIndex, next, prev, isFirst, isLast } = useDeckNavigation(slides.length)

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(getFullscreenElement() === deckRef.current)
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    toggleElementFullscreen(deckRef.current)
  }, [])

  const rootStyle = {
    '--deck-accent': organization.primary_color ?? 'var(--foreground)',
  } as CSSProperties

  const slideWidthPercent = 100 / slides.length
  const trackTransform = `translateX(-${currentIndex * slideWidthPercent}%)`

  const announcement = useMemo(() => {
    const heading = slides[currentIndex]?.ariaHeading ?? ''
    return `Slide ${currentIndex + 1} of ${slides.length}: ${heading}`
  }, [currentIndex, slides])

  return (
    <div
      ref={deckRef}
      role="region"
      aria-roledescription="slide deck"
      aria-label="Performance review"
      data-testid="review-deck"
      className="bg-background relative h-full max-h-screen w-full overflow-hidden rounded-lg border lg:aspect-video lg:h-auto"
      style={rootStyle}
    >
      <div className="screen-only h-full w-full">
        <div
          data-testid="review-deck-track"
          data-current-index={currentIndex}
          className="flex h-full transition-transform duration-[400ms] ease-out"
          style={{
            width: `${slides.length * 100}%`,
            transform: trackTransform,
          }}
        >
          {slides.map((slide, i) => (
            <Slide
              key={slide.key}
              index={i + 1}
              total={slides.length}
              ariaHeading={slide.ariaHeading}
              widthPercent={slideWidthPercent}
            >
              {slide.render('screen')}
            </Slide>
          ))}
        </div>
      </div>

      <div className="print-only">
        {slides.map((slide) => (
          <div key={slide.key} className="print-slide">
            {slide.render('print')}
          </div>
        ))}
      </div>

      <div
        data-testid="review-deck-live-region"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <div className="print:hidden">
        <DeckControls
          onPrev={prev}
          onNext={next}
          onToggleFullscreen={toggleFullscreen}
          isFirst={isFirst}
          isLast={isLast}
          isFullscreen={isFullscreen}
        />
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </div>

      <DeckPrintStyles />
    </div>
  )
}
