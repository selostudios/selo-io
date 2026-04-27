'use client'

import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { getSlide, type SlideKey } from '@/lib/reviews/slides/registry'
import { useHiddenSlides } from './hidden-slides-provider'

export interface VisibilityToggleProps {
  slideKey: SlideKey
  /** Hide the toggle entirely for slides that aren't hideable (e.g. cover). */
  hideable?: boolean
  className?: string
}

/**
 * Eye icon paired with a Switch — the icon is the visual indicator, the
 * switch is the interactive control. Reads from `<HiddenSlidesProvider>`
 * so flips dim the corresponding slide / tile immediately while the server
 * action settles in the background.
 */
export function VisibilityToggle({ slideKey, hideable = true, className }: VisibilityToggleProps) {
  const { isHidden, toggle } = useHiddenSlides()
  const slide = getSlide(slideKey)
  const resolvedHideable = hideable && slide.hideable

  if (!resolvedHideable) return null

  const hidden = isHidden(slideKey)
  const Icon = hidden ? EyeOff : Eye
  const label = hidden ? `Show ${slide.label} slide` : `Hide ${slide.label} slide`

  return (
    <span
      className={cn('inline-flex items-center gap-2', className)}
      data-testid={`visibility-toggle-${slideKey}`}
    >
      <Icon
        className={cn(
          'size-4 transition-colors',
          hidden ? 'text-muted-foreground' : 'text-foreground'
        )}
        aria-hidden="true"
      />
      <Switch
        checked={!hidden}
        onCheckedChange={() => toggle(slideKey)}
        aria-label={label}
        data-testid={`visibility-switch-${slideKey}`}
      />
    </span>
  )
}
