import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

/**
 * Editor-mode overlay that dims a hidden slide and labels it with a "Hidden"
 * badge. The deck's editor surface wraps every slide whose registry key
 * appears in `hiddenSlides` with this component so admins can still see and
 * edit the slide while making the off state visually obvious.
 *
 * Presentation mode never renders this — hidden slides are filtered out
 * upstream in `<ReviewDeck>`.
 */
export function HiddenSlideOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="hidden-slide-overlay"
      className="relative flex h-full w-full items-stretch opacity-40"
    >
      <Badge variant="secondary" className="absolute top-4 left-4 z-10">
        Hidden
      </Badge>
      {children}
    </div>
  )
}
