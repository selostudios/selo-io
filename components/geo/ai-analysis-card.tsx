'use client'

import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { GEOPageAnalysis } from '@/lib/geo/types'

interface AIAnalysisCardProps {
  analyses: GEOPageAnalysis[]
}

function getPriorityColor(priority: string): string {
  const p = priority.toLowerCase()
  switch (p) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

export function AIAnalysisCard({ analyses }: AIAnalysisCardProps) {
  // Collect all recommendations and sort by priority
  const allRecommendations = analyses.flatMap((a) => a.recommendations)
  const sortedRecommendations = allRecommendations.sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    const aPriority = priorityOrder[a.priority.toLowerCase()] ?? 99
    const bPriority = priorityOrder[b.priority.toLowerCase()] ?? 99
    return aPriority - bPriority
  })

  // Take top 10 recommendations
  const topRecommendations = sortedRecommendations.slice(0, 10)

  // Count by priority
  const criticalCount = topRecommendations.filter(
    (r) => r.priority.toLowerCase() === 'critical'
  ).length
  const highCount = topRecommendations.filter((r) => r.priority.toLowerCase() === 'high').length

  if (topRecommendations.length === 0) {
    return null
  }

  return (
    <Collapsible defaultOpen className="group/recommendations">
      <div className="bg-background flex w-full items-center justify-between rounded-md px-4 py-3">
        <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/recommendations:-rotate-90'
            )}
          />
          <span className="text-lg font-semibold">Recommendations</span>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 text-sm">
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 tabular-nums">
              {criticalCount} critical
            </span>
          )}
          {highCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 tabular-nums">
              {highCount} high
            </span>
          )}
        </div>
      </div>
      <CollapsibleContent className="mt-2 space-y-2 pl-4">
        {topRecommendations.map((rec, idx) => (
          <div key={idx} className="rounded-md bg-muted/30 p-3">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${getPriorityColor(rec.priority)}`}
              >
                {rec.priority}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium">{rec.category}</p>
                <p className="text-xs text-muted-foreground">{rec.issue}</p>
                <p className="text-xs">{rec.recommendation}</p>
                {rec.expectedImpact && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Impact:</span> {rec.expectedImpact}
                  </p>
                )}
                {rec.learnMoreUrl && (
                  <a
                    href={rec.learnMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Learn more →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
