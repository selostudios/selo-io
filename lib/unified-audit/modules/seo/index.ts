import { ScoreDimension } from '@/lib/enums'
import { getChecksByScore } from '../../checks'
import { calculateSEOModuleScore } from './scoring'
import type { AuditModule } from '../../types'

export const seoModule: AuditModule = {
  dimension: ScoreDimension.SEO,
  checks: getChecksByScore(ScoreDimension.SEO),
  calculateScore: (checks) => calculateSEOModuleScore(checks),
}
