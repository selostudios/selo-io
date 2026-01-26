'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { GEOPageAnalysis } from '@/lib/geo/types'

interface AIAnalysisCardProps {
  analyses: GEOPageAnalysis[]
  strategicScore: number
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 80) return 'default'
  if (score >= 60) return 'secondary'
  return 'destructive'
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

export function AIAnalysisCard({ analyses, strategicScore }: AIAnalysisCardProps) {
  // Calculate average scores across all pages
  const avgScores = {
    dataQuality: Math.round(
      analyses.reduce((sum, a) => sum + a.scores.dataQuality, 0) / analyses.length
    ),
    expertCredibility: Math.round(
      analyses.reduce((sum, a) => sum + a.scores.expertCredibility, 0) / analyses.length
    ),
    comprehensiveness: Math.round(
      analyses.reduce((sum, a) => sum + a.scores.comprehensiveness, 0) / analyses.length
    ),
    citability: Math.round(
      analyses.reduce((sum, a) => sum + a.scores.citability, 0) / analyses.length
    ),
    authority: Math.round(
      analyses.reduce((sum, a) => sum + a.scores.authority, 0) / analyses.length
    ),
  }

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
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>AI Quality Analysis</CardTitle>
            <CardDescription>
              Analyzed {analyses.length} {analyses.length === 1 ? 'page' : 'pages'} for content
              quality and citability
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-sm text-muted-foreground">Strategic Score</div>
            <div className={`text-2xl font-bold ${getScoreColor(strategicScore)}`}>
              {strategicScore}/100
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quality Dimension Scores */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Quality Dimensions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Data Quality */}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Data Quality</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                    >
                      <Info className="size-3" />
                      <span className="sr-only">About Data Quality</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Are statistics meaningful and properly sourced? High-quality data includes
                      specific numbers with clear attribution and methodology.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant={getScoreBadgeVariant(avgScores.dataQuality)}>
                {avgScores.dataQuality}
              </Badge>
            </div>

            {/* Expert Credibility */}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Expert Credibility</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                    >
                      <Info className="size-3" />
                      <span className="sr-only">About Expert Credibility</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Are quotes from actual authorities with clear credentials? Real expert quotes
                      include specific names, titles, and affiliations.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant={getScoreBadgeVariant(avgScores.expertCredibility)}>
                {avgScores.expertCredibility}
              </Badge>
            </div>

            {/* Comprehensiveness */}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Comprehensiveness</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                    >
                      <Info className="size-3" />
                      <span className="sr-only">About Comprehensiveness</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Does content thoroughly cover the topic? Comprehensive content addresses main
                      topics, edge cases, and provides depth.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant={getScoreBadgeVariant(avgScores.comprehensiveness)}>
                {avgScores.comprehensiveness}
              </Badge>
            </div>

            {/* Citability */}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Citability</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                    >
                      <Info className="size-3" />
                      <span className="sr-only">About Citability</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Would AI engines actually cite this content? Citable content has clear,
                      extractable statements that answer specific questions.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant={getScoreBadgeVariant(avgScores.citability)}>
                {avgScores.citability}
              </Badge>
            </div>

            {/* Authority */}
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Authority</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
                    >
                      <Info className="size-3" />
                      <span className="sr-only">About Authority</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      E-E-A-T signals: Experience, Expertise, Authoritativeness, and
                      Trustworthiness. Includes author credentials, recent updates, and trust
                      indicators.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant={getScoreBadgeVariant(avgScores.authority)}>
                {avgScores.authority}
              </Badge>
            </div>
          </div>
        </div>

        {/* Top Recommendations */}
        {topRecommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Top Recommendations</h3>
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
          </div>
        )}
      </CardContent>
    </Card>
  )
}
