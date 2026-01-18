import type { AuditCheckDefinition } from '@/lib/audit/types'
import { missingMetaDescription } from './seo/missing-meta-description'

export const allChecks: AuditCheckDefinition[] = [
  missingMetaDescription,
  // More checks will be added here
]

export function getChecksByType(
  type: 'seo' | 'ai_readiness' | 'technical'
): AuditCheckDefinition[] {
  return allChecks.filter((check) => check.type === type)
}
