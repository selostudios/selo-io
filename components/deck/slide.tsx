import type { ReactNode } from 'react'
import { SlideChromeLogo } from './slide-chrome-logo'

export interface SlideProps {
  /** 1-indexed slide number, used for the aria-label. */
  index: number
  /** Total slide count. */
  total: number
  /** Short heading used in the aria-label (e.g. "Google Analytics"). */
  ariaHeading: string
  /** Width of this slide relative to the track, as a percentage (0–100). */
  widthPercent: number
  children: ReactNode
}

/**
 * A single slide within the review deck. Owns accessibility semantics and
 * sizing; content is provided by the parent via `children`.
 */
export function Slide({ index, total, ariaHeading, widthPercent, children }: SlideProps) {
  return (
    <section
      data-testid="review-deck-slide"
      role="group"
      aria-roledescription="slide"
      aria-label={`Slide ${index} of ${total}: ${ariaHeading}`}
      className="bg-background relative flex h-full shrink-0 items-stretch"
      style={{ width: `${widthPercent}%` }}
    >
      {children}
      <SlideChromeLogo />
    </section>
  )
}
