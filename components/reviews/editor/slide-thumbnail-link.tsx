import Link from 'next/link'
import type { SlideKey } from '@/lib/reviews/slides/registry'

export interface SlideThumbnailLinkProps {
  orgId: string
  reviewId: string
  slideKey: SlideKey
  children: React.ReactNode
  className?: string
}

/**
 * Thin wrapper around `<Link>` that builds the slide editor URL in one place
 * so callers don't have to duplicate the route convention.
 */
export function SlideThumbnailLink({
  orgId,
  reviewId,
  slideKey,
  children,
  className,
}: SlideThumbnailLinkProps) {
  const href = `/${orgId}/reports/performance/${reviewId}/slides/${slideKey}`
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
