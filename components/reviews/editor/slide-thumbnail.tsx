import { cn } from '@/lib/utils'
import { getSlide, type SlideKey } from '@/lib/reviews/slides/registry'
import { HideSlideToggle } from './hide-slide-toggle'
import { SlideIcon } from './slide-icon'
import { SlideThumbnailLink } from './slide-thumbnail-link'

export interface SlideThumbnailProps {
  orgId: string
  reviewId: string
  slideKey: SlideKey
  hidden: boolean
}

/**
 * Card-shaped thumbnail for a single slide in the editor's slide strip.
 * Composes a `<SlideThumbnailLink>` (the visual body) with a positioned
 * `<HideSlideToggle>` sibling so we don't nest a button inside an anchor.
 */
export function SlideThumbnail({ orgId, reviewId, slideKey, hidden }: SlideThumbnailProps) {
  const { label, hideable } = getSlide(slideKey)

  return (
    <article
      data-testid={`slide-thumbnail-${slideKey}`}
      data-hidden={String(hidden)}
      className={cn('relative rounded-lg border p-4 transition-opacity', hidden && 'opacity-50')}
    >
      <SlideThumbnailLink orgId={orgId} reviewId={reviewId} slideKey={slideKey} className="block">
        <div className="flex items-center gap-3">
          <SlideIcon slideKey={slideKey} className="text-muted-foreground size-5" />
          <span className="text-sm font-medium">{label}</span>
        </div>
      </SlideThumbnailLink>
      <div className="absolute top-2 right-2 z-10">
        <HideSlideToggle
          reviewId={reviewId}
          slideKey={slideKey}
          hidden={hidden}
          hideable={hideable}
        />
      </div>
    </article>
  )
}
