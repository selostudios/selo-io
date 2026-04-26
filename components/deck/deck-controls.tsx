import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DeckControlsProps {
  onPrev: () => void
  onNext: () => void
  onToggleFullscreen: () => void
  isFirst: boolean
  isLast: boolean
  isFullscreen: boolean
}

/**
 * Deck controls: fullscreen sits top-right; prev/next sit on the bottom
 * edge. All buttons are icon-only ghost styling so they stay out of the
 * way of presentation content.
 */
export function DeckControls({
  onPrev,
  onNext,
  onToggleFullscreen,
  isFirst,
  isLast,
  isFullscreen,
}: DeckControlsProps) {
  return (
    <>
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous slide"
          disabled={isFirst}
          onClick={onPrev}
        >
          <ChevronLeft />
        </Button>
      </div>

      <div className="absolute right-4 bottom-4 z-10">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next slide"
          disabled={isLast}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      </div>
    </>
  )
}
