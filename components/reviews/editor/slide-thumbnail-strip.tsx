import { SLIDES } from '@/lib/reviews/slides/registry'
import { SlideThumbnail } from './slide-thumbnail'

export interface SlideThumbnailStripProps {
  orgId: string
  reviewId: string
}

export function SlideThumbnailStrip({ orgId, reviewId }: SlideThumbnailStripProps) {
  return (
    <div className="grid grid-cols-7 gap-3">
      {SLIDES.map((slide) => (
        <SlideThumbnail key={slide.key} orgId={orgId} reviewId={reviewId} slideKey={slide.key} />
      ))}
    </div>
  )
}
