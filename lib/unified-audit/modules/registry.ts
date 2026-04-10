import { seoModule } from './seo'
import { performanceModule } from './performance'
import { aiReadinessModule } from './ai-readiness'
import type { AuditModule } from '../types'
import type { ScoreDimension } from '@/lib/enums'

export const auditModules: AuditModule[] = [seoModule, performanceModule, aiReadinessModule]

export function getModule(dimension: ScoreDimension): AuditModule | undefined {
  return auditModules.find((m) => m.dimension === dimension)
}
