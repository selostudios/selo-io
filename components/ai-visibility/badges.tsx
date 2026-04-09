import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
import { AIPlatform, BrandSentiment } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES, SENTIMENT_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import { cn } from '@/lib/utils'

// =============================================================================
// Platform Badge
// =============================================================================

const PLATFORM_COLORS: Record<AIPlatform, string> = {
  [AIPlatform.ChatGPT]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [AIPlatform.Claude]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  [AIPlatform.Perplexity]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

export function PlatformBadge({ platform }: { platform: AIPlatform }) {
  return (
    <Badge variant="secondary" className={PLATFORM_COLORS[platform]}>
      {PLATFORM_DISPLAY_NAMES[platform]}
    </Badge>
  )
}

// =============================================================================
// Sentiment Badge
// =============================================================================

const SENTIMENT_COLORS: Record<BrandSentiment, string> = {
  [BrandSentiment.Positive]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  [BrandSentiment.Neutral]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  [BrandSentiment.Negative]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

export function SentimentBadge({ sentiment }: { sentiment: BrandSentiment }) {
  return (
    <Badge variant="secondary" className={SENTIMENT_COLORS[sentiment]}>
      {SENTIMENT_DISPLAY_NAMES[sentiment]}
    </Badge>
  )
}

// =============================================================================
// Status Chip (Mentioned check, Cited check, etc.)
// =============================================================================

interface StatusChipProps {
  positive: boolean
  label: string
}

export function StatusChip({ positive, label }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        positive
          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      )}
    >
      {positive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  )
}

// =============================================================================
// Position Badge (1st third, 2nd third, 3rd third)
// =============================================================================

const POSITION_LABELS: Record<number, string> = {
  1: '1st third',
  2: '2nd third',
  3: '3rd third',
}

export function PositionBadge({ position }: { position: number | null }) {
  if (!position) return null
  return (
    <span className="text-muted-foreground text-xs">
      Pos: {POSITION_LABELS[position] ?? `${position}`}
    </span>
  )
}

// =============================================================================
// Competitor Pills
// =============================================================================

interface CompetitorMention {
  name: string
  mentioned: boolean
  cited: boolean
}

export function CompetitorPills({ competitors }: { competitors: CompetitorMention[] }) {
  if (!competitors?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {competitors.map((c) => (
        <span
          key={c.name}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
            c.mentioned
              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
              : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
          )}
        >
          {c.name}
          {c.mentioned ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
      ))}
    </div>
  )
}
