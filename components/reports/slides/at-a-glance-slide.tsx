'use client'

import { SlideContainer } from '../slide-container'
import { ScoreRing } from '../score-ring'
import { cn } from '@/lib/utils'
import { ScoreStatus } from '@/lib/enums'
import { getScoreStatus, getScoreStatusLabel } from '@/lib/reports'

interface AtAGlanceSlideProps {
  combinedScore: number
  seoScore: number
  pageSpeedScore: number
  aioScore: number
}

function ScoreCard({
  title,
  score,
  icon,
}: {
  title: string
  score: number
  icon: React.ReactNode
}) {
  const status = getScoreStatus(score)
  const statusLabel = getScoreStatusLabel(status)

  const statusColors = {
    [ScoreStatus.Good]: 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-900',
    [ScoreStatus.NeedsImprovement]:
      'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-900',
    [ScoreStatus.Poor]: 'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900',
  }

  const scoreColors = {
    [ScoreStatus.Good]: 'text-green-600 dark:text-green-400',
    [ScoreStatus.NeedsImprovement]: 'text-yellow-600 dark:text-yellow-400',
    [ScoreStatus.Poor]: 'text-red-600 dark:text-red-400',
  }

  return (
    <div className={cn('rounded-xl border p-6', statusColors[status])}>
      <div className="mb-4 flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <span className="font-medium">{title}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-4xl font-bold', scoreColors[status])}>{score}</span>
        <span className="text-muted-foreground text-sm">{statusLabel}</span>
      </div>
    </div>
  )
}

function getVerdict(score: number): string {
  if (score >= 80) return 'Strong foundation with room to excel'
  if (score >= 60) return 'Good foundation with clear opportunities'
  if (score >= 40) return 'Significant room for improvement'
  return 'Requires immediate attention'
}

export function AtAGlanceSlide({
  combinedScore,
  seoScore,
  pageSpeedScore,
  aioScore,
}: AtAGlanceSlideProps) {
  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-12 text-center text-3xl font-bold md:text-4xl">Your Site at a Glance</h2>

        {/* Main Score */}
        <div className="mb-12 flex flex-col items-center">
          <ScoreRing score={combinedScore} size="xl" animate />
          <p className="text-muted-foreground mt-6 text-center text-lg">
            {getVerdict(combinedScore)}
          </p>
        </div>

        {/* Score Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <ScoreCard
            title="Search Visibility"
            score={seoScore}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            }
          />
          <ScoreCard
            title="Site Speed"
            score={pageSpeedScore}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
          />
          <ScoreCard
            title="AI Readiness"
            score={aioScore}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            }
          />
        </div>
      </div>
    </SlideContainer>
  )
}
