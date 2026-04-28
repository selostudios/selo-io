import { getSlide, type SlideKey } from '@/lib/reviews/slides/registry'

export interface SlideIconProps {
  slideKey: SlideKey
  className?: string
}

/**
 * Renders the lucide icon registered for the given slide key. Pure
 * presentational — the icon mapping lives in the slide registry.
 */
export function SlideIcon({ slideKey, className }: SlideIconProps) {
  const Icon = getSlide(slideKey).icon
  return <Icon className={className} aria-hidden="true" />
}
