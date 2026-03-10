import type { AuditCheckDefinition } from '../../types'
import { brokenInternalLinks } from './broken-internal-links'
import { redirectChains } from './redirect-chains'
import { nonDescriptiveUrl } from './non-descriptive-url'
import { internalLinking } from './internal-linking'

export const linksChecks: AuditCheckDefinition[] = [
  brokenInternalLinks,
  redirectChains,
  nonDescriptiveUrl,
  internalLinking,
]

export { brokenInternalLinks, redirectChains, nonDescriptiveUrl, internalLinking }
