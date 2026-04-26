import { SLIDES, type SlideKey } from '@/lib/reviews/slides/registry'
import { SlideThumbnail } from './slide-thumbnail'

export interface SlideThumbnailStripProps {
  orgId: string
  reviewId: string
  hiddenSlides: readonly SlideKey[]
}

export function SlideThumbnailStrip({ orgId, reviewId, hiddenSlides }: SlideThumbnailStripProps) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {SLIDES.map((slide) => (
        <SlideThumbnail
          key={slide.key}
          orgId={orgId}
          reviewId={reviewId}
          slideKey={slide.key}
          hidden={hiddenSlides.includes(slide.key)}
        />
      ))}
    </div>
  )
}
