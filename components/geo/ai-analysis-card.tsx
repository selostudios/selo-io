'use client'

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

  return (
    <div className="space-y-4 rounded-lg border border-gray-300 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
      <div>
        <h4 className="text-sm font-semibold">Top Recommendations</h4>
        <p className="text-xs text-muted-foreground">
          Based on analysis of {analyses.length} {analyses.length === 1 ? 'page' : 'pages'}
        </p>
      </div>
      {topRecommendations.length > 0 && (
        <div className="space-y-2">
          {topRecommendations.map((rec, idx) => (
            <div key={idx} className="rounded-md border bg-muted/30 p-3">
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
        </div>
      )}
    </div>
  )
}
