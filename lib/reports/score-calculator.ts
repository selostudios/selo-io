import { ScoreStatus } from '@/lib/enums'
import type { ScoreBreakdown, ScoreWeights } from './types'
import { DEFAULT_SCORE_WEIGHTS, getScoreStatus, isScoreGood } from './types'

// Re-export utility functions
export { getScoreStatus, isScoreGood }

/**
 * Calculate the combined score from individual audit scores
 * Uses weighted average: SEO (50%) + PageSpeed (30%) + AIO (20%)
 */
export function calculateCombinedScore(
  seoScore: number | null,
  pageSpeedScore: number | null,
  aioScore: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number | null {
  // All scores are required
  if (seoScore === null || pageSpeedScore === null || aioScore === null) {
    return null
  }

  // Validate scores are in range
  const scores = [seoScore, pageSpeedScore, aioScore]
  for (const score of scores) {
    if (score < 0 || score > 100) {
      return null
    }
  }

  // Calculate weighted average
  const combined =
    seoScore * weights.seo +
    pageSpeedScore * weights.page_speed +
    aioScore * weights.aio

  // Round to nearest integer
  return Math.round(combined)
}

/**
 * Get a detailed breakdown of score calculations
 */
export function getScoreBreakdown(
  seoScore: number | null,
  pageSpeedScore: number | null,
  aioScore: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): ScoreBreakdown {
  const combinedScore = calculateCombinedScore(
    seoScore,
    pageSpeedScore,
    aioScore,
    weights
  )

  return {
    seo_score: seoScore,
    seo_weight: weights.seo,
    page_speed_score: pageSpeedScore,
    page_speed_weight: weights.page_speed,
    aio_score: aioScore,
    aio_weight: weights.aio,
    combined_score: combinedScore ?? 0,
  }
}

/**
 * Get score with status for presentation
 */
export function getScoreWithStatus(score: number | null): {
  score: number
  status: ScoreStatus
} {
  const actualScore = score ?? 0
  return {
    score: actualScore,
    status: getScoreStatus(score),
  }
}

/**
 * Determine if a score indicates room for improvement
 * Used to decide whether to show projections
 */
export function hasImprovementPotential(
  score: number | null,
  threshold: number = 85
): boolean {
  return score === null || score < threshold
}

/**
 * Calculate potential improvement in combined score
 * if a specific category improved to target score
 */
export function calculatePotentialImprovement(
  currentScores: {
    seo: number | null
    pageSpeed: number | null
    aio: number | null
  },
  category: 'seo' | 'pageSpeed' | 'aio',
  targetScore: number,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): {
  currentCombined: number | null
  targetCombined: number | null
  improvement: number | null
} {
  const currentCombined = calculateCombinedScore(
    currentScores.seo,
    currentScores.pageSpeed,
    currentScores.aio,
    weights
  )

  // Create target scores with the improved category
  const targetScores = { ...currentScores }
  targetScores[category] = targetScore

  const targetCombined = calculateCombinedScore(
    targetScores.seo,
    targetScores.pageSpeed,
    targetScores.aio,
    weights
  )

  const improvement =
    currentCombined !== null && targetCombined !== null
      ? targetCombined - currentCombined
      : null

  return {
    currentCombined,
    targetCombined,
    improvement,
  }
}

/**
 * Format score for display with appropriate styling context
 */
export function formatScore(score: number | null): string {
  if (score === null) return '-'
  return `${score}`
}

/**
 * Format score with percentage
 */
export function formatScorePercent(score: number | null): string {
  if (score === null) return '-'
  return `${score}%`
}

/**
 * Get color class for score status
 * Returns Tailwind CSS classes for text color
 */
export function getScoreColorClass(status: ScoreStatus): string {
  switch (status) {
    case ScoreStatus.Good:
      return 'text-green-600 dark:text-green-400'
    case ScoreStatus.NeedsImprovement:
      return 'text-yellow-600 dark:text-yellow-400'
    case ScoreStatus.Poor:
      return 'text-red-600 dark:text-red-400'
  }
}

/**
 * Get background color class for score status
 * Returns Tailwind CSS classes for background color
 */
export function getScoreBackgroundClass(status: ScoreStatus): string {
  switch (status) {
    case ScoreStatus.Good:
      return 'bg-green-100 dark:bg-green-900/30'
    case ScoreStatus.NeedsImprovement:
      return 'bg-yellow-100 dark:bg-yellow-900/30'
    case ScoreStatus.Poor:
      return 'bg-red-100 dark:bg-red-900/30'
  }
}

/**
 * Get badge variant for score status
 * Compatible with Shadcn badge variants
 */
export function getScoreBadgeVariant(
  status: ScoreStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case ScoreStatus.Good:
      return 'default'
    case ScoreStatus.NeedsImprovement:
      return 'secondary'
    case ScoreStatus.Poor:
      return 'destructive'
  }
}

/**
 * Get human-readable label for score status
 */
export function getScoreStatusLabel(status: ScoreStatus): string {
  switch (status) {
    case ScoreStatus.Good:
      return 'Good'
    case ScoreStatus.NeedsImprovement:
      return 'Needs Improvement'
    case ScoreStatus.Poor:
      return 'Poor'
  }
}

/**
 * Calculate overall grade letter (A, B, C, D, F) from score
 */
export function getScoreGrade(score: number | null): string {
  if (score === null) return '-'
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Calculate weighted contribution of each category to combined score
 * Returns percentage contribution for visualization
 */
export function getScoreContributions(
  seoScore: number | null,
  pageSpeedScore: number | null,
  aioScore: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): {
  seo: { points: number; percent: number }
  pageSpeed: { points: number; percent: number }
  aio: { points: number; percent: number }
} {
  const combined = calculateCombinedScore(seoScore, pageSpeedScore, aioScore, weights)

  if (combined === null || combined === 0) {
    return {
      seo: { points: 0, percent: 0 },
      pageSpeed: { points: 0, percent: 0 },
      aio: { points: 0, percent: 0 },
    }
  }

  const seoPoints = (seoScore ?? 0) * weights.seo
  const pageSpeedPoints = (pageSpeedScore ?? 0) * weights.page_speed
  const aioPoints = (aioScore ?? 0) * weights.aio

  return {
    seo: {
      points: Math.round(seoPoints),
      percent: Math.round((seoPoints / combined) * 100),
    },
    pageSpeed: {
      points: Math.round(pageSpeedPoints),
      percent: Math.round((pageSpeedPoints / combined) * 100),
    },
    aio: {
      points: Math.round(aioPoints),
      percent: Math.round((aioPoints / combined) * 100),
    },
  }
}
