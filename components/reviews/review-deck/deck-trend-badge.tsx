import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeckTrendBadgeProps {
  /** QoQ percent change (e.g. 12.4 = +12.4%, -3.1 = -3.1%). Null when unavailable. */
  delta: number | null
}

/**
 * Compact trend indicator for metric strip tiles. Shows an up/down arrow with
 * the absolute percent magnitude. Returns null when no comparison is available
 * so tiles for first-quarter metrics don't render an empty badge.
 */
export function DeckTrendBadge({ delta }: DeckTrendBadgeProps) {
  if (delta === null || !Number.isFinite(delta)) return null

  const isFlat = Math.abs(delta) < 0.05
  if (isFlat) return null

  const isPositive = delta > 0
  const Icon = isPositive ? ArrowUp : ArrowDown

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium tabular-nums md:text-base',
        isPositive ? 'text-emerald-600' : 'text-rose-600'
      )}
      data-testid="deck-trend-badge"
    >
      <Icon className="size-4" aria-hidden="true" />
      {Math.abs(delta).toFixed(1)}%
    </div>
  )
}
