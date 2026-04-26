import type { ReactNode } from 'react'
import { SlideNarrative } from './slide-narrative'

export interface SlideLayoutProps {
  heading: string
  /** Optional content rendered between the heading and the narrative (metric strip, post grid, etc.). */
  body?: ReactNode
  narrative: string
  /** Stable selector for the narrative region — each slide variant supplies its own. */
  narrativeTestId: string
  /** Optional sub-heading rendered directly above the narrative bullets. */
  narrativeHeading?: string
}

/**
 * Shared frame for every deck body slide. Owns outer padding, vertical
 * rhythm, the accent-coloured heading, and the narrative block so each slide
 * variant only supplies a heading + optional body slot. Keeping the spacing
 * here is the single source of truth — drift between slides was the bug that
 * motivated this extraction.
 */
export function SlideLayout({
  heading,
  body,
  narrative,
  narrativeTestId,
  narrativeHeading,
}: SlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-12 px-8 py-12 md:gap-16 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        {heading}
      </h2>

      {body}

      <div className="space-y-3">
        {narrativeHeading && (
          <h3
            data-testid={`${narrativeTestId}-heading`}
            className="text-foreground text-lg font-semibold tracking-tight md:text-xl lg:text-2xl"
          >
            {narrativeHeading}
          </h3>
        )}
        <SlideNarrative text={narrative} testId={narrativeTestId} />
      </div>
    </div>
  )
}
