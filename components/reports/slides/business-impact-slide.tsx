'use client'

import { SlideContainer } from '../slide-container'
import type { ReportProjection } from '@/lib/reports/types'

interface BusinessImpactSlideProps {
  projections: ReportProjection[]
  combinedScore: number
  accentColor?: string | null
}

function ProjectionCard({ projection }: { projection: ReportProjection }) {
  if (!projection.show) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h4 className="text-muted-foreground mb-4 text-sm font-medium tracking-wide uppercase">
        {projection.area}
      </h4>

      <div className="mb-4 flex items-center gap-4">
        {/* Current */}
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-400">{projection.current_value}</div>
          <div className="text-muted-foreground text-xs">Current</div>
        </div>

        {/* Arrow */}
        <div className="flex-1">
          <div className="flex items-center">
            <div className="h-px flex-1 bg-gradient-to-r from-slate-300 to-indigo-400 dark:from-slate-700 dark:to-indigo-600" />
            <svg className="h-4 w-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {/* Target */}
        <div className="text-center">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {projection.target_value}
          </div>
          <div className="text-muted-foreground text-xs">Potential</div>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">{projection.potential_impact}</p>
    </div>
  )
}

export function BusinessImpactSlide({
  projections,
  combinedScore,
  accentColor,
}: BusinessImpactSlideProps) {
  const visibleProjections = projections.filter((p) => p.show)
  const potentialScore = Math.min(combinedScore + 20, 100) // Estimate potential improvement

  // Use brand accent color for the gradient, with indigo fallback
  const gradientFrom = accentColor || '#4f46e5' // indigo-600
  const gradientTo = accentColor ? `${accentColor}cc` : '#7c3aed' // slightly transparent accent, or purple-600

  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col justify-center">
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">Business Impact</h2>
        <p className="text-muted-foreground mb-12 text-lg">
          What you could achieve with the recommended improvements
        </p>

        {visibleProjections.length > 0 ? (
          <>
            <div className="mb-12 grid gap-6 md:grid-cols-3">
              {visibleProjections.map((projection, index) => (
                <ProjectionCard key={index} projection={projection} />
              ))}
            </div>

            {/* Combined impact statement */}
            <div
              className="rounded-xl p-8 text-white"
              style={{
                background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Combined Potential</h3>
                  <p className="mt-2 text-white/80">
                    Implementing these improvements could raise your overall score to{' '}
                    <span className="font-bold">{potentialScore}/100</span>
                  </p>
                </div>
                <div className="text-6xl font-bold text-white/20">
                  +{potentialScore - combinedScore}
                </div>
              </div>
            </div>

            <p className="text-muted-foreground mt-6 text-center text-sm">
              * Based on industry benchmarks; actual results may vary
            </p>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h3 className="text-xl font-semibold">Excellent Performance</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Your site is already performing well across all areas. Focus on maintaining these
                results and exploring advanced optimizations.
              </p>
            </div>
          </div>
        )}
      </div>
    </SlideContainer>
  )
}
