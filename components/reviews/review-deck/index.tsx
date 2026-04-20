'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const COVER_HEADING = 'Quarterly Performance Review'

const SLIDE_COUNT = 1 + BODY_SECTIONS.length // cover + 5 body slides = 6

/** Full list of slide headings used for aria announcements, in deck order. */
const SLIDE_HEADINGS: string[] = [COVER_HEADING, ...BODY_SECTIONS.map((s) => s.heading)]

/**
 * Returns the current fullscreen element, preferring the standard API and
 * falling back to Safari's webkit-prefixed API (still required on iPad as of
 * iPadOS 17).
 */
function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  if (document.fullscreenElement) return document.fullscreenElement
  // @ts-expect-error - webkitFullscreenElement is not in lib.dom types.
  const webkitEl: Element | null | undefined = document.webkitFullscreenElement
  return webkitEl ?? null
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
  const { currentIndex, next, prev, isFirst, isLast } = useDeckNavigation(SLIDE_COUNT)
  const [isFullscreen, setIsFullscreen] = useState(false)

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
    const el = deckRef.current
    if (!el) return

    const currentFullscreenEl = getFullscreenElement()

    if (currentFullscreenEl === el) {
      // Exit fullscreen — try standard then webkit.
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {
          /* User gesture missing, blocked, etc. — swallow. */
        })
        return
      }
      // @ts-expect-error - webkitExitFullscreen is not in lib.dom types.
      const webkitExit: (() => Promise<void> | void) | undefined = document.webkitExitFullscreen
      if (typeof webkitExit === 'function') {
        try {
          const result = webkitExit.call(document)
          if (result && typeof (result as Promise<void>).catch === 'function') {
            ;(result as Promise<void>).catch(() => {})
          }
        } catch {
          /* no-op */
        }
      }
      return
    }

    // Enter fullscreen — try standard then webkit.
    if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => {
        /* Permission denied, iframe blocked, etc. — swallow. */
      })
      return
    }
    // @ts-expect-error - webkitRequestFullscreen is not in lib.dom types.
    const webkitRequest: (() => Promise<void> | void) | undefined = el.webkitRequestFullscreen
    if (typeof webkitRequest === 'function') {
      try {
        const result = webkitRequest.call(el)
        if (result && typeof (result as Promise<void>).catch === 'function') {
          ;(result as Promise<void>).catch(() => {})
        }
      } catch {
        /* no-op */
      }
    }
    // If neither API is available, no-op silently (keep button visible).
  }, [])

  const rootStyle = {
    '--deck-accent': organization.primary_color ?? 'var(--foreground)',
  } as CSSProperties

  const slideWidthPercent = 100 / SLIDE_COUNT
  const trackTransform = `translateX(-${currentIndex * slideWidthPercent}%)`

  const announcement = useMemo(() => {
    const heading = SLIDE_HEADINGS[currentIndex] ?? ''
    return `Slide ${currentIndex + 1} of ${SLIDE_COUNT}: ${heading}`
  }, [currentIndex])

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

      <div
        data-testid="review-deck-live-region"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
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
