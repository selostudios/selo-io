import type { AuditCheckDefinition } from '../../types'

import { contentDepth } from './content-depth'
import { readability } from './readability'
import { paragraphStructure } from './paragraph-structure'
import { listUsage } from './list-usage'
import { contentFreshness } from './content-freshness'

export const contentQualityChecks: AuditCheckDefinition[] = [
  contentDepth,
  readability,
  paragraphStructure,
  listUsage,
  contentFreshness,
]

export { contentDepth, readability, paragraphStructure, listUsage, contentFreshness }
