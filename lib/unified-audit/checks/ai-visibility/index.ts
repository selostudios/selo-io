export { contentAccessibility } from './content-accessibility'
export { htmlStructure } from './html-structure'
export { markdownAvailability } from './markdown-availability'
export { citability } from './citability'
export { brandMentions } from './brand-mentions'
export { platformReadiness } from './platform-readiness'

import { contentAccessibility } from './content-accessibility'
import { htmlStructure } from './html-structure'
import { markdownAvailability } from './markdown-availability'
import { citability } from './citability'
import { brandMentions } from './brand-mentions'
import { platformReadiness } from './platform-readiness'
import type { AuditCheckDefinition } from '../../types'

export const aiVisibilityChecks: AuditCheckDefinition[] = [
  contentAccessibility,
  htmlStructure,
  markdownAvailability,
  citability,
  brandMentions,
  platformReadiness,
]
