'use client'

import { AIPlatform } from '@/lib/enums'
import { PLATFORM_DISPLAY_NAMES } from '@/lib/ai-visibility/types'
import { ResearchResultCard } from './research-result-card'
import type { ResearchResult } from '@/lib/ai-visibility/research'

interface ResearchResultListProps {
  results: ResearchResult[]
  expectedPlatforms: AIPlatform[]
  onSaveToMonitoring?: () => void
  timedOut?: boolean
}

export function ResearchResultList({
  results,
  expectedPlatforms,
  onSaveToMonitoring,
  timedOut,
}: ResearchResultListProps) {
  const arrivedPlatforms = new Set(results.map((r) => r.platform))
  const pendingPlatforms = expectedPlatforms.filter((p) => !arrivedPlatforms.has(p))

  return (
    <div className="space-y-3">
      {/* Arrived results */}
      {results.map((result) => (
        <ResearchResultCard
          key={result.id}
          result={result}
          onSaveToMonitoring={onSaveToMonitoring}
        />
      ))}

      {/* Pending platforms (skeleton cards) */}
      {pendingPlatforms.map((platform) => (
        <div
          key={platform}
          className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4"
          data-testid={`research-pending-${platform}`}
        >
          <div className="size-2 animate-pulse rounded-full bg-gray-400" />
          <span className="text-muted-foreground text-sm">
            {timedOut
              ? `${PLATFORM_DISPLAY_NAMES[platform] ?? platform} — timed out`
              : `${PLATFORM_DISPLAY_NAMES[platform] ?? platform} — loading...`}
          </span>
        </div>
      ))}
    </div>
  )
}
