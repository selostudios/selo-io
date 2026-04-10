import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck, PostCrawlResult } from '../../types'

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

function calculateCheckScore(checks: AuditCheck[]): number {
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

/**
 * AI Readiness score: 50% programmatic checks + 50% Claude strategic score.
 * Falls back to 100% programmatic when no AI analysis is available.
 */
export function calculateAIReadinessModuleScore(
  checks: AuditCheck[],
  phaseResult?: PostCrawlResult
): number {
  const programmaticScore = calculateCheckScore(checks)
  const strategicScore = phaseResult?.strategicScore as number | null | undefined
  if (strategicScore === null || strategicScore === undefined) return programmaticScore
  return Math.round(programmaticScore * 0.5 + strategicScore * 0.5)
}
