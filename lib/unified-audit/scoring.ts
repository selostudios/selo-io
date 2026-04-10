import { CheckPriority, CheckStatus, ScoreDimension, ScoreStatus } from '@/lib/enums'
import type { AuditCheck } from './types'
import { DEFAULT_SCORE_WEIGHTS, type ScoreWeights } from './types'

const PRIORITY_WEIGHTS: Record<string, number> = {
  [CheckPriority.Critical]: 3,
  [CheckPriority.Recommended]: 2,
  [CheckPriority.Optional]: 1,
}

const STATUS_POINTS: Record<string, number> = {
  [CheckStatus.Passed]: 100,
  [CheckStatus.Warning]: 50,
  [CheckStatus.Failed]: 0,
}

/**
 * Calculate a weighted score from a set of audit checks.
 * Critical checks count 3x, Recommended 2x, Optional 1x.
 * Passed = 100pts, Warning = 50pts, Failed = 0pts.
 */
export function calculateCheckScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0
  let totalWeight = 0
  let earnedWeight = 0
  for (const check of checks) {
    const weight = PRIORITY_WEIGHTS[check.priority] ?? 1
    totalWeight += weight
    earnedWeight += weight * (STATUS_POINTS[check.status] ?? 0)
  }
  if (totalWeight === 0) return 0
  return Math.round((earnedWeight / (totalWeight * 100)) * 100)
}

export function calculateSEOScore(checks: AuditCheck[]): number {
  return calculateCheckScore(checks.filter((c) => c.feeds_scores.includes(ScoreDimension.SEO)))
}

export function calculatePerformanceScore(checks: AuditCheck[]): number {
  return calculateCheckScore(
    checks.filter((c) => c.feeds_scores.includes(ScoreDimension.Performance))
  )
}

/**
 * AI Readiness score blends programmatic checks (50%) with Claude AI strategic score (50%).
 * When no AI analysis is available, uses 100% programmatic.
 */
export function calculateAIReadinessScore(
  checks: AuditCheck[],
  strategicScore: number | null
): number {
  const programmaticScore = calculateCheckScore(
    checks.filter((c) => c.feeds_scores.includes(ScoreDimension.AIReadiness))
  )
  if (strategicScore === null) return programmaticScore
  return Math.round(programmaticScore * 0.5 + strategicScore * 0.5)
}

export function calculateOverallScore(
  seo: number | null,
  performance: number | null,
  aiReadiness: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number | null {
  const scores: { value: number; weight: number }[] = []
  if (seo !== null) scores.push({ value: seo, weight: weights.seo })
  if (performance !== null) scores.push({ value: performance, weight: weights.performance })
  if (aiReadiness !== null) scores.push({ value: aiReadiness, weight: weights.ai_readiness })

  if (scores.length === 0) return null

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const weightedSum = scores.reduce((sum, s) => sum + s.value * s.weight, 0)

  return Math.round(weightedSum / totalWeight)
}

export function getScoreStatus(score: number): ScoreStatus {
  if (score >= 80) return ScoreStatus.Good
  if (score >= 60) return ScoreStatus.NeedsImprovement
  return ScoreStatus.Poor
}

export { DEFAULT_SCORE_WEIGHTS }
