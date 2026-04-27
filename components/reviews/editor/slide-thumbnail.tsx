'use client'

import { cn } from '@/lib/utils'
import { getSlide, type SlideKey } from '@/lib/reviews/slides/registry'
import { useHiddenSlides } from './hidden-slides-provider'
import { SlideIcon } from './slide-icon'
import { SlideThumbnailLink } from './slide-thumbnail-link'
import { VisibilityToggle } from './visibility-toggle'

export interface SlideThumbnailProps {
  orgId: string
  reviewId: string
  slideKey: SlideKey
}

/**
 * Card-shaped thumbnail for a single slide in the editor's slide strip.
 * Reads visibility from `<HiddenSlidesProvider>` so the dim state and the
 * embedded toggle stay in sync — and flip together optimistically when the
 * user clicks the switch.
 */
export function SlideThumbnail({ orgId, reviewId, slideKey }: SlideThumbnailProps) {
  const { isHidden } = useHiddenSlides()
  const { label, hideable } = getSlide(slideKey)
  const hidden = isHidden(slideKey)

  return (
    <article
      data-testid={`slide-thumbnail-${slideKey}`}
      data-hidden={String(hidden)}
      className={cn('relative rounded-lg border transition-opacity', hidden && 'opacity-50')}
    >
      <SlideThumbnailLink
        orgId={orgId}
        reviewId={reviewId}
        slideKey={slideKey}
        className="hover:bg-accent/50 block rounded-lg p-4 transition-colors"
      >
        <div className="flex items-center gap-3 pr-12">
          <SlideIcon slideKey={slideKey} className="text-muted-foreground size-5 flex-shrink-0" />
          <span className="text-sm font-medium">{label}</span>
        </div>
      </SlideThumbnailLink>
      {hideable && (
        <div className="absolute top-1/2 right-3 z-10 -translate-y-1/2">
          <VisibilityToggle slideKey={slideKey} hideable={hideable} />
        </div>
      )}
    </article>
  )
}
