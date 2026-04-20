'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { useDeckNavigation } from './use-deck-navigation'
import { Slide } from './slide'
import { CoverSlide } from './cover-slide'
import { BodySlide } from './body-slide'
import { DeckControls } from './deck-controls'

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

const SLIDE_COUNT = 1 + BODY_SECTIONS.length // cover + 5 body slides = 6

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
  const { currentIndex, next, prev, isFirst, isLast } = useDeckNavigation(SLIDE_COUNT)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(document.fullscreenElement === deckRef.current)
    }
    document.addEventListener('fullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = deckRef.current
    if (!el) return
    if (document.fullscreenElement === el) {
      document.exitFullscreen?.()
    } else {
      el.requestFullscreen?.()
    }
  }, [])

  const rootStyle = {
    '--deck-accent': organization.primary_color ?? 'var(--foreground)',
  } as CSSProperties

  const slideWidthPercent = 100 / SLIDE_COUNT
  const trackTransform = `translateX(-${currentIndex * slideWidthPercent}%)`

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
      <div
        data-testid="review-deck-track"
        data-current-index={currentIndex}
        className="flex h-full transition-transform duration-[400ms] ease-out"
        style={{
          width: `${SLIDE_COUNT * 100}%`,
          transform: trackTransform,
        }}
      >
        <Slide
          index={1}
          total={SLIDE_COUNT}
          ariaHeading={`${organization.name} — ${quarter}`}
          widthPercent={slideWidthPercent}
        >
          <CoverSlide
            organization={{ name: organization.name, logo_url: organization.logo_url }}
            quarter={quarter}
            periodStart={periodStart}
            periodEnd={periodEnd}
            subtitle={narrative.cover_subtitle}
          />
        </Slide>

        {BODY_SECTIONS.map((section, i) => (
          <Slide
            key={section.key}
            index={i + 2}
            total={SLIDE_COUNT}
            ariaHeading={section.heading}
            widthPercent={slideWidthPercent}
          >
            <BodySlide heading={section.heading} text={narrative[section.key] ?? ''} />
          </Slide>
        ))}
      </div>

      <DeckControls
        onPrev={prev}
        onNext={next}
        onToggleFullscreen={toggleFullscreen}
        isFirst={isFirst}
        isLast={isLast}
        isFullscreen={isFullscreen}
      />
    </div>
  )
}
