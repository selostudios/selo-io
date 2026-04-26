'use client'

import { useTransition } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { showError } from '@/components/ui/sonner'
import { setSlideVisibility } from '@/lib/reviews/actions'
import type { SlideKey } from '@/lib/reviews/slides/registry'

export interface HideSlideToggleProps {
  reviewId: string
  slideKey: SlideKey
  hidden: boolean
  hideable: boolean
}

/**
 * Eye / EyeOff toggle that flips a slide's visibility via the
 * `setSlideVisibility` server action. The cover slide cannot be hidden, so
 * when `hideable` is false we render an inert dash placeholder instead.
 */
export function HideSlideToggle({ reviewId, slideKey, hidden, hideable }: HideSlideToggleProps) {
  const [isPending, startTransition] = useTransition()

  if (!hideable) {
    return (
      <span data-testid={`hide-slide-toggle-${slideKey}`} aria-hidden="true">
        —
      </span>
    )
  }

  function handleClick() {
    startTransition(async () => {
      const result = await setSlideVisibility(reviewId, slideKey, !hidden)
      if (!result.success) {
        showError(result.error)
      }
    })
  }

  const Icon = hidden ? EyeOff : Eye
  const label = hidden ? `Show ${slideKey}` : `Hide ${slideKey}`

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      aria-label={label}
      data-testid={`hide-slide-toggle-${slideKey}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  )
}
