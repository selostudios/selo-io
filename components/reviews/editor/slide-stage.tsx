'use client'

import { ReviewDeck } from '@/components/reviews/review-deck'
import type { SlideKey } from '@/lib/reviews/slides/registry'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

export interface SlideStageProps {
  slideKey: SlideKey
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
  data: SnapshotData
  hiddenSlides: readonly SlideKey[]
}

/**
 * Thin client wrapper around `<ReviewDeck>` for the slide editor route. The
 * deck is opened in `'editor'` mode pre-focused on `slideKey` so authors land
 * directly on the slide they want to edit. Sizing matches the read-only
 * preview client so the deck renders at a consistent stage size.
 */
export function SlideStage({
  slideKey,
  organization,
  quarter,
  periodStart,
  periodEnd,
  narrative,
  data,
  hiddenSlides,
}: SlideStageProps) {
  return (
    <div
      data-testid="slide-stage"
      className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-center"
    >
      <ReviewDeck
        mode="editor"
        initialSlideKey={slideKey}
        organization={organization}
        quarter={quarter}
        periodStart={periodStart}
        periodEnd={periodEnd}
        narrative={narrative}
        data={data}
        hiddenSlides={hiddenSlides}
      />
    </div>
  )
}
