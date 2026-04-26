'use client'

import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import type { SlideDefinition } from '@/lib/reviews/slides/registry'
import { CoverSlide } from './cover-slide'
import { BodySlide } from './body-slide'
import { GaBodySlide } from './ga-body-slide'
import { LinkedInBodySlide } from './linkedin-body-slide'
import { ContentBodySlide } from './content-body-slide'

/**
 * Render surface for a slide. The deck emits two subtrees — `.screen-only`
 * (carousel) and `.print-only` (stacked) — and asks each slide to render for
 * the appropriate mode. Only the GA slide currently varies its output (live
 * metric strip on screen, compact text table in print); all other kinds
 * ignore the prop.
 */
export type SlideRenderMode = 'screen' | 'print'

export interface SlideRendererProps {
  slide: SlideDefinition
  narrative: NarrativeBlocks
  data: SnapshotData | null | undefined
  organization: {
    name: string
    logo_url: string | null
  }
  quarter: string
  /** ISO date string, e.g. '2026-01-01' */
  periodStart: string
  /** ISO date string, e.g. '2026-03-31' */
  periodEnd: string
  /** Print/screen surface — NOT the editor/presentation `DeckMode`. */
  mode: SlideRenderMode
}

/**
 * Pure dispatch component. Picks the body component for `slide.kind` and
 * passes the appropriate slice of narrative + data. The exhaustive `default`
 * case ensures adding a new `SlideKind` to the registry breaks the build
 * until this switch handles it.
 *
 * Hide/filter logic stays in `<ReviewDeck>` — this component renders a
 * single slide regardless of visibility state.
 */
export function SlideRenderer({
  slide,
  narrative,
  data,
  organization,
  quarter,
  periodStart,
  periodEnd,
  mode,
}: SlideRendererProps) {
  switch (slide.kind) {
    case 'cover':
      return (
        <CoverSlide
          organization={organization}
          quarter={quarter}
          periodStart={periodStart}
          periodEnd={periodEnd}
          subtitle={narrative.cover_subtitle}
        />
      )
    case 'ga':
      return (
        <GaBodySlide
          narrative={narrative[slide.narrativeBlockKey] ?? ''}
          data={data?.ga}
          mode={mode}
        />
      )
    case 'linkedin':
      return (
        <LinkedInBodySlide
          narrative={narrative[slide.narrativeBlockKey] ?? ''}
          data={data?.linkedin}
          mode={mode}
        />
      )
    case 'content':
      return (
        <ContentBodySlide
          narrative={narrative[slide.narrativeBlockKey] ?? ''}
          posts={data?.linkedin?.top_posts ?? []}
          mode={mode}
        />
      )
    case 'prose':
      return <BodySlide heading={slide.label} text={narrative[slide.narrativeBlockKey] ?? ''} />
    default: {
      // Exhaustiveness check — adding a new SlideKind to the registry will
      // break this build until the switch handles it. Don't silently fall
      // through to a generic body renderer.
      const exhaustive: never = slide.kind
      throw new Error(`Unhandled slide kind: ${exhaustive as string}`)
    }
  }
}
