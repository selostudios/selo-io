'use client'

import { SlideContainer } from '../slide-container'

interface ExecutiveSummarySlideProps {
  summary: string
  stats: {
    pagesAnalyzed: number
    opportunitiesFound: number
    recommendationsCount: number
  }
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{value}</div>
      <div className="text-muted-foreground mt-1 text-sm">{label}</div>
    </div>
  )
}

export function ExecutiveSummarySlide({ summary, stats }: ExecutiveSummarySlideProps) {
  // Split summary into paragraphs
  const paragraphs = summary.split('\n\n').filter(Boolean)

  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-12 text-3xl font-bold md:text-4xl">Executive Summary</h2>

        {/* Summary Text */}
        <div className="mb-12 max-w-3xl space-y-6">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-muted-foreground text-lg leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-3 gap-8">
            <StatItem value={stats.pagesAnalyzed} label="Pages Analyzed" />
            <StatItem value={stats.opportunitiesFound} label="Opportunities Found" />
            <StatItem value={stats.recommendationsCount} label="Recommendations" />
          </div>
        </div>
      </div>
    </SlideContainer>
  )
}
