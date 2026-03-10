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
 * AI Readiness score blends programmatic checks (40%) with Claude AI strategic score (60%).
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
  return Math.round(programmaticScore * 0.4 + strategicScore * 0.6)
}

export function calculateOverallScore(
  seo: number | null,
  performance: number | null,
  aiReadiness: number | null,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS
): number | null {
  if (seo === null || performance === null || aiReadiness === null) return null
  return Math.round(
    seo * weights.seo + performance * weights.performance + aiReadiness * weights.ai_readiness
  )
}

export function getScoreStatus(score: number): ScoreStatus {
  if (score >= 80) return ScoreStatus.Good
  if (score >= 60) return ScoreStatus.NeedsImprovement
  return ScoreStatus.Poor
}

export { DEFAULT_SCORE_WEIGHTS }
