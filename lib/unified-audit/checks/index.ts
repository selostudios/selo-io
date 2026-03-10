import type { AuditCheckDefinition } from '../types'
import { CheckCategory, ScoreDimension } from '@/lib/enums'

import { crawlabilityChecks } from './crawlability'
import { metaContentChecks } from './meta-content'
import { contentStructureChecks } from './content-structure'
import { contentQualityChecks } from './content-quality'
import { linksChecks } from './links'
import { mediaChecks } from './media'
import { structuredDataChecks } from './structured-data'
import { securityChecks } from './security'
import { performanceChecks } from './performance'
import { aiVisibilityChecks } from './ai-visibility'

export const allChecks: AuditCheckDefinition[] = [
  ...crawlabilityChecks,
  ...metaContentChecks,
  ...contentStructureChecks,
  ...contentQualityChecks,
  ...linksChecks,
  ...mediaChecks,
  ...structuredDataChecks,
  ...securityChecks,
  ...performanceChecks,
  ...aiVisibilityChecks,
]

export function getChecksByCategory(category: CheckCategory): AuditCheckDefinition[] {
  return allChecks.filter((c) => c.category === category)
}

export function getCheckByName(name: string): AuditCheckDefinition | undefined {
  return allChecks.find((c) => c.name === name)
}

export function getChecksByScore(dimension: ScoreDimension): AuditCheckDefinition[] {
  return allChecks.filter((c) => c.feedsScores.includes(dimension))
}

export const siteWideChecks = allChecks.filter((c) => c.isSiteWide)
export const pageSpecificChecks = allChecks.filter((c) => !c.isSiteWide)

// Re-export category arrays for direct access
export {
  crawlabilityChecks,
  metaContentChecks,
  contentStructureChecks,
  contentQualityChecks,
  linksChecks,
  mediaChecks,
  structuredDataChecks,
  securityChecks,
  performanceChecks,
  aiVisibilityChecks,
}
