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
  /** Unused in Phase 4; accepted for forward-compatibility with later phases. */
  data: SnapshotData
}

type BodySection = {
  key: keyof NarrativeBlocks
  heading: string
}

const BODY_SECTIONS: BodySection[] = [
  { key: 'ga_summary', heading: 'Google Analytics' },
  { key: 'linkedin_insights', heading: 'LinkedIn' },
  { key: 'initiatives', heading: 'Initiatives' },
  { key: 'takeaways', heading: 'Takeaways' },
  { key: 'planning', heading: 'Planning Ahead' },
]

interface BuiltSlide {
  key: string
  ariaHeading: string
  content: ReactNode
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  data: _data,
}: ReviewDeckProps) {
  const deckRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const slides: BuiltSlide[] = useMemo(
    () => [
      {
        key: 'cover',
        ariaHeading: 'Quarterly Performance Review',
        content: (
          <CoverSlide
            organization={{ name: organization.name, logo_url: organization.logo_url }}
            quarter={quarter}
            periodStart={periodStart}
            periodEnd={periodEnd}
            subtitle={narrative.cover_subtitle}
          />
        ),
      },
      ...BODY_SECTIONS.map((section) => ({
        key: section.key,
        ariaHeading: section.heading,
        content: <BodySlide heading={section.heading} text={narrative[section.key] ?? ''} />,
      })),
    ],
    [organization, quarter, periodStart, periodEnd, narrative]
  )

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
              {slide.content}
            </Slide>
          ))}
        </div>
      </div>

      <div className="print-only">
        {slides.map((slide) => (
          <div key={slide.key} className="print-slide">
            {slide.content}
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
