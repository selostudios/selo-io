import type { AuditCheckDefinition } from '../../types'
import { contentAccessibility } from './content-accessibility'
import { htmlStructure } from './html-structure'
import { markdownAvailability } from './markdown-availability'
import { citability } from './citability'
import { brandMentions } from './brand-mentions'
import { platformReadiness } from './platform-readiness'

export const aiVisibilityChecks: AuditCheckDefinition[] = [
  contentAccessibility,
  htmlStructure,
  markdownAvailability,
  citability,
  brandMentions,
  platformReadiness,
]

export {
  contentAccessibility,
  htmlStructure,
  markdownAvailability,
  citability,
  brandMentions,
  platformReadiness,
}
