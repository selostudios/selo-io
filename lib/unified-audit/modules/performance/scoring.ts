import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck } from '../../types'

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

export function calculatePerformanceModuleScore(checks: AuditCheck[]): number {
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
