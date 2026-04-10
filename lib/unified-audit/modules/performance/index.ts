import { ScoreDimension } from '@/lib/enums'
import { getChecksByScore } from '../../checks'
import { calculatePerformanceModuleScore } from './scoring'
import { runPSIPhase } from './psi-phase'
import type { AuditModule } from '../../types'

export const performanceModule: AuditModule = {
  dimension: ScoreDimension.Performance,
  checks: getChecksByScore(ScoreDimension.Performance),
  runPostCrawlPhase: runPSIPhase,
  calculateScore: (checks) => calculatePerformanceModuleScore(checks),
}
