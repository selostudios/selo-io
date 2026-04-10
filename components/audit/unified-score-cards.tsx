'use client'

import { AlertTriangle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScoreCard } from './score-cards'
import { ScoreDimension } from '@/lib/enums'

const DIMENSION_LABELS: Record<string, string> = {
  [ScoreDimension.SEO]: 'SEO',
  [ScoreDimension.Performance]: 'Performance',
  [ScoreDimension.AIReadiness]: 'AI Readiness',
}

interface UnifiedScoreCardsProps {
  overall: number | null
  seo: number | null
  performance: number | null
  aiReadiness: number | null
  moduleStatuses?: Record<string, string>
}

export function UnifiedScoreCards({
  overall,
  seo,
  performance,
  aiReadiness,
  moduleStatuses,
}: UnifiedScoreCardsProps) {
  const failedModules = moduleStatuses
    ? Object.entries(moduleStatuses)
        .filter(([, status]) => status === 'failed')
        .map(([dim]) => DIMENSION_LABELS[dim] || dim)
    : []
  const completedModules = moduleStatuses
    ? Object.entries(moduleStatuses)
        .filter(([, status]) => status === 'completed')
        .map(([dim]) => DIMENSION_LABELS[dim] || dim)
    : []
  const hasPartialScore = failedModules.length > 0 && completedModules.length > 0

  let overallDescription = 'Weighted average: SEO (40%), Performance (30%), AI Readiness (30%).'
  if (hasPartialScore) {
    overallDescription = `This score only reflects ${completedModules.join(' and ')}. ${failedModules.join(' and ')} encountered errors and ${failedModules.length === 1 ? 'is' : 'are'} not included. Re-run failed modules for a complete score.`
  } else if (failedModules.length > 0 && completedModules.length === 0) {
    overallDescription = 'All modules encountered errors. No score available.'
  }

  return (
    <div className="flex gap-4" data-testid="audit-score-cards">
      <div className="relative flex-1">
        <ScoreCard label="Overall" score={overall} description={overallDescription} />
        {failedModules.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute top-2 right-2" data-testid="partial-score-warning">
                <AlertTriangle className="size-4 text-yellow-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{overallDescription}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <ScoreCard
        label="SEO"
        score={seo}
        description="Search engine optimization: meta tags, headings, content, links, and crawlability."
      />
      <ScoreCard
        label="Performance"
        score={performance}
        description="Technical performance: page speed, security, mobile-friendliness, and Core Web Vitals."
      />
      <ScoreCard
        label="AI Readiness"
        score={aiReadiness}
        description="AI visibility: structured data, llms.txt, content citability, and platform readiness."
      />
    </div>
  )
}
