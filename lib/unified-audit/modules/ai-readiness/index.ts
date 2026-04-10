import { ScoreDimension } from '@/lib/enums'
import { getChecksByScore } from '../../checks'
import { calculateAIReadinessModuleScore } from './scoring'
import { runAIPhase } from './ai-phase'
import type { AuditModule } from '../../types'

export const aiReadinessModule: AuditModule = {
  dimension: ScoreDimension.AIReadiness,
  checks: getChecksByScore(ScoreDimension.AIReadiness),
  runPostCrawlPhase: runAIPhase,
  calculateScore: (checks, phaseResult) => calculateAIReadinessModuleScore(checks, phaseResult),
}
