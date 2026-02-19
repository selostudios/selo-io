'use client'

import { SlideContainer } from '../slide-container'
import { cn } from '@/lib/utils'
import { ReportPriority, ReportEffort, ReportOwner } from '@/lib/enums'
import type { ReportRecommendation } from '@/lib/reports/types'

interface RecommendationsSlideProps {
  recommendations: ReportRecommendation[]
  page: number // 0 or 1 for pagination
  accentColor?: string | null
}

const impactConfig = {
  [ReportPriority.High]: {
    label: 'High Impact',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  },
  [ReportPriority.Medium]: {
    label: 'Medium Impact',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  [ReportPriority.Low]: {
    label: 'Low Impact',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
}

const effortConfig = {
  [ReportEffort.QuickWin]: {
    label: 'Quick Win',
    icon: '⚡',
  },
  [ReportEffort.Medium]: {
    label: 'Medium Effort',
    icon: '🔧',
  },
  [ReportEffort.Major]: {
    label: 'Major Project',
    icon: '🏗️',
  },
}

function getOwnerConfig(accentColor?: string | null) {
  return {
    [ReportOwner.Marketing]: {
      label: 'Marketing',
      color: accentColor ? undefined : 'text-purple-600 dark:text-purple-400',
      inlineColor: accentColor || undefined,
    },
    [ReportOwner.Developer]: {
      label: 'Developer',
      color: 'text-blue-600 dark:text-blue-400',
      inlineColor: undefined,
    },
    [ReportOwner.Content]: {
      label: 'Content',
      color: 'text-amber-600 dark:text-amber-400',
      inlineColor: undefined,
    },
  }
}

function RecommendationRow({
  recommendation,
  accentColor,
}: {
  recommendation: ReportRecommendation
  accentColor?: string | null
}) {
  const impact = impactConfig[recommendation.impact]
  const effort = effortConfig[recommendation.effort]
  const ownerConfig = getOwnerConfig(accentColor)
  const owner = ownerConfig[recommendation.owner]

  return (
    <div className="flex items-start gap-6 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      {/* Rank Number */}
      <div
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold ${!accentColor ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : ''}`}
        style={
          accentColor ? { backgroundColor: `${accentColor}1a`, color: accentColor } : undefined
        }
      >
        {recommendation.rank}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="mb-2 font-semibold">{recommendation.title}</h4>
        <div className="flex flex-wrap items-center gap-3">
          {/* Impact Badge */}
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', impact.color)}>
            {impact.label}
          </span>

          {/* Effort */}
          <span className="text-muted-foreground text-sm">
            {effort.icon} {effort.label}
          </span>

          {/* Owner */}
          <span
            className={cn('text-sm font-medium', owner.color)}
            style={owner.inlineColor ? { color: owner.inlineColor } : undefined}
          >
            {owner.label}
          </span>
        </div>
      </div>
    </div>
  )
}

export function RecommendationsSlide({
  recommendations,
  page,
  accentColor,
}: RecommendationsSlideProps) {
  // Split recommendations across two pages
  const itemsPerPage = 5
  const startIndex = page * itemsPerPage
  const pageRecommendations = recommendations.slice(startIndex, startIndex + itemsPerPage)
  const totalPages = Math.ceil(recommendations.length / itemsPerPage)

  const marketingColor = accentColor || undefined

  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">Recommendations</h2>
            <p className="text-muted-foreground mt-2">Your top priorities for improvement</p>
          </div>
          {totalPages > 1 && (
            <span className="text-muted-foreground text-sm">
              Page {page + 1} of {totalPages}
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4">
          {pageRecommendations.map((rec) => (
            <RecommendationRow key={rec.rank} recommendation={rec} accentColor={accentColor} />
          ))}
        </div>

        {pageRecommendations.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground mb-2 text-6xl">👏</div>
              <h3 className="text-xl font-semibold">No recommendations needed</h3>
              <p className="text-muted-foreground mt-2">
                Your site is performing excellently across all metrics.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        {pageRecommendations.length > 0 && page === 0 && (
          <div className="text-muted-foreground mt-8 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="font-medium">Effort:</span> ⚡ Quick Win · 🔧 Medium · 🏗️ Major
              </div>
              <div>
                <span className="font-medium">Owner:</span>{' '}
                <span
                  className={!marketingColor ? 'text-purple-600 dark:text-purple-400' : undefined}
                  style={marketingColor ? { color: marketingColor } : undefined}
                >
                  Marketing
                </span>{' '}
                · <span className="text-blue-600 dark:text-blue-400">Developer</span> ·{' '}
                <span className="text-amber-600 dark:text-amber-400">Content</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideContainer>
  )
}
