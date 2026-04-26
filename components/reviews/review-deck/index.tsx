'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CSSProperties } from 'react'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { SLIDES, type SlideKey } from '@/lib/reviews/slides/registry'
import { useDeckNavigation } from '@/components/deck/use-deck-navigation'
import { Slide } from '@/components/deck/slide'
import { DeckControls } from '@/components/deck/deck-controls'
import { getFullscreenElement, toggleElementFullscreen } from '@/components/deck/fullscreen'
import { DeckPrintStyles } from '@/components/deck/print-styles'
import { SlideChromeLogo } from '@/components/deck/slide-chrome-logo'
import { HiddenSlideOverlay } from './hidden-slide-overlay'
import { SlideRenderer } from './slide-renderer'

/**
 * Which surface is rendering the deck. `'presentation'` is the public/share
 * surface — it filters out hidden slides and skips the "What Resonated" slide
 * when there are no top posts. `'editor'` is the authoring surface — it keeps
 * every registry slide (so admins can edit the narrative even before posts
 * land) and dims hidden slides with a "Hidden" badge instead of removing them.
 */
export type DeckMode = 'editor' | 'presentation'

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
  /** Snapshot metric data. `data.ga` powers the GA slide's strip/table; `data.linkedin` powers the LinkedIn slide's strip/table. */
  data: SnapshotData
  /**
   * Slide keys (matching the registry) to mark as hidden. In presentation
   * mode these slides are filtered out entirely; in editor mode they remain
   * visible but are dimmed with a "Hidden" badge so authors can still toggle
   * them.
   */
  hiddenSlides?: readonly string[]
  /** Render surface — defaults to `'presentation'`. */
  mode?: DeckMode
  /**
   * Optional slide key to start the deck on. Resolved against the rendered
   * slide list (after mode-specific filtering); falls back to the first slide
   * when the key isn't present.
   */
  initialSlideKey?: SlideKey
  /**
   * When provided, the deck delegates slide navigation to the caller. Clicking
   * prev/next (and pressing keyboard shortcuts) calls `onNavigate` with the
   * destination slide key instead of mutating internal state. The caller is
   * expected to remount the deck (e.g. via `key`) when the slide changes.
   */
  onNavigate?: (slideKey: SlideKey) => void
}

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
 * snapshot detail page, and the public share page. It produces a 6- or
 * 7-slide deck: cover + Google Analytics + LinkedIn + (optional) What
 * Resonated + Initiatives + Takeaways + Planning Ahead.
 *
 * In `'presentation'` mode (default), slides whose keys appear in
 * `hiddenSlides` are filtered out, and the "What Resonated" slide is
 * filtered out when `data.linkedin.top_posts` is empty.
 *
 * In `'editor'` mode, every registry slide is rendered (so authors can edit
 * the narrative even before posts seed) and hidden slides are wrapped in a
 * dimming overlay with a "Hidden" badge.
 *
 * Per-slide body rendering is delegated to `<SlideRenderer>` — this component
 * handles orchestration only (filtering, navigation, fullscreen, print).
 */
export function ReviewDeck({
  organization,
  quarter,
  periodStart,
  periodEnd,
  narrative,
  data,
  hiddenSlides = [],
  mode = 'presentation',
  initialSlideKey,
  onNavigate,
}: ReviewDeckProps) {
  const deckRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const slides: BuiltSlide[] = useMemo(() => {
    // Enforce the registry's `hideable` contract here so callers passing a
    // non-hideable key (e.g. 'cover') don't accidentally dim or drop it.
    const hidden = new Set(
      hiddenSlides.filter((key) => SLIDES.find((s) => s.key === key)?.hideable !== false)
    )
    const isEditor = mode === 'editor'
    const posts = data?.linkedin?.top_posts ?? []

    const built: BuiltSlide[] = []

    for (const slide of SLIDES) {
      // In presentation mode, drop hidden slides outright.
      if (!isEditor && hidden.has(slide.key)) continue

      // In presentation mode only, drop the content_highlights slide when no
      // top posts exist. Editor keeps it so authors can still edit the block.
      if (slide.kind === 'content' && !isEditor && posts.length === 0) continue

      let render: BuiltSlide['render'] = (renderMode) => (
        <SlideRenderer
          slide={slide}
          narrative={narrative}
          data={data}
          organization={{ name: organization.name, logo_url: organization.logo_url }}
          quarter={quarter}
          periodStart={periodStart}
          periodEnd={periodEnd}
          mode={renderMode}
        />
      )

      // Editor mode wraps hidden slides in the dimming overlay so authors can
      // still see and edit them while making it visually clear they're off.
      if (isEditor && hidden.has(slide.key)) {
        const innerRender = render
        render = (renderMode) => <HiddenSlideOverlay>{innerRender(renderMode)}</HiddenSlideOverlay>
      }

      built.push({
        key: slide.key,
        ariaHeading: slide.kind === 'cover' ? 'Quarterly Performance Review' : slide.label,
        render,
      })
    }

    return built
  }, [organization, quarter, periodStart, periodEnd, narrative, data, hiddenSlides, mode])

  const initialIndex = useMemo(() => {
    if (!initialSlideKey) return 0
    const idx = slides.findIndex((s) => s.key === initialSlideKey)
    return idx === -1 ? 0 : idx
  }, [slides, initialSlideKey])

  const handleIndexNavigate = useMemo(() => {
    if (!onNavigate) return undefined
    return (target: number) => {
      const slide = slides[target]
      if (slide) onNavigate(slide.key as SlideKey)
    }
  }, [onNavigate, slides])

  const { currentIndex, next, prev, isFirst, isLast } = useDeckNavigation(
    slides.length,
    initialIndex,
    { onNavigate: handleIndexNavigate }
  )

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
          <div key={slide.key} className="print-slide relative">
            {slide.render('print')}
            <SlideChromeLogo />
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

      <DeckPrintStyles />
    </div>
  )
}
