'use client'

import { SlideContainer } from '../slide-container'
import { cn } from '@/lib/utils'
import { ReportPriority, AuditSource } from '@/lib/enums'
import type { ReportOpportunity } from '@/lib/reports/types'

interface OpportunitiesSlideProps {
  opportunities: ReportOpportunity[]
  page: number // 0 or 1 for pagination
}

const priorityConfig = {
  [ReportPriority.High]: {
    label: 'High Priority',
    description: 'Address these first for maximum impact',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-900',
    accentColor: 'bg-red-500',
    textColor: 'text-red-600 dark:text-red-400',
  },
  [ReportPriority.Medium]: {
    label: 'Medium Priority',
    description: 'Important for continued growth',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-900',
    accentColor: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
  },
  [ReportPriority.Low]: {
    label: 'Low Priority',
    description: 'Nice to have improvements',
    bgColor: 'bg-slate-50 dark:bg-slate-900/50',
    borderColor: 'border-slate-200 dark:border-slate-800',
    accentColor: 'bg-slate-400',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
}

const sourceLabels = {
  [AuditSource.SEO]: 'SEO',
  [AuditSource.PageSpeed]: 'Speed',
  [AuditSource.AIO]: 'AI',
}

function OpportunityCard({ opportunity }: { opportunity: ReportOpportunity }) {
  const config = priorityConfig[opportunity.priority]

  return (
    <div className={cn('rounded-lg border p-5', config.bgColor, config.borderColor)}>
      <div className="mb-3 flex items-start justify-between">
        <h4 className="font-semibold">{opportunity.title}</h4>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          )}
        >
          {sourceLabels[opportunity.source]}
        </span>
      </div>
      <p className="text-muted-foreground mb-3 text-sm">{opportunity.description}</p>
      {opportunity.impact && (
        <p className="text-sm">
          <span className="font-medium">Impact:</span>{' '}
          <span className="text-muted-foreground">{opportunity.impact}</span>
        </p>
      )}
    </div>
  )
}

function PrioritySection({
  priority,
  opportunities,
}: {
  priority: ReportPriority
  opportunities: ReportOpportunity[]
}) {
  const config = priorityConfig[priority]

  if (opportunities.length === 0) return null

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className={cn('h-3 w-3 rounded-full', config.accentColor)} />
        <div>
          <h3 className={cn('font-semibold', config.textColor)}>{config.label}</h3>
          <p className="text-muted-foreground text-sm">{config.description}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </div>
  )
}

export function OpportunitiesSlide({ opportunities, page }: OpportunitiesSlideProps) {
  // Split opportunities across two pages
  const itemsPerPage = 6
  const startIndex = page * itemsPerPage
  const pageOpportunities = opportunities.slice(startIndex, startIndex + itemsPerPage)

  // Group by priority
  const highPriority = pageOpportunities.filter((o) => o.priority === ReportPriority.High)
  const mediumPriority = pageOpportunities.filter((o) => o.priority === ReportPriority.Medium)
  const lowPriority = pageOpportunities.filter((o) => o.priority === ReportPriority.Low)

  const totalPages = Math.ceil(opportunities.length / itemsPerPage)

  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-3xl font-bold md:text-4xl">Opportunities for Improvement</h2>
          {totalPages > 1 && (
            <span className="text-muted-foreground text-sm">
              Page {page + 1} of {totalPages}
            </span>
          )}
        </div>

        <div className="flex-1 space-y-8">
          <PrioritySection priority={ReportPriority.High} opportunities={highPriority} />
          <PrioritySection priority={ReportPriority.Medium} opportunities={mediumPriority} />
          <PrioritySection priority={ReportPriority.Low} opportunities={lowPriority} />
        </div>

        {pageOpportunities.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground mb-2 text-6xl">✨</div>
              <h3 className="text-xl font-semibold">Great job!</h3>
              <p className="text-muted-foreground mt-2">
                No significant issues found. Your site is performing well.
              </p>
            </div>
          </div>
        )}
      </div>
    </SlideContainer>
  )
}
