import type { AIOCheckDefinition } from '@/lib/aio/types'

// Technical Foundation checks
import { aiCrawlerAccess } from './technical-foundation/ai-crawler-access'
import { schemaMarkup } from './technical-foundation/schema-markup'
import { pageSpeed } from './technical-foundation/page-speed'
import { sslCertificate } from './technical-foundation/ssl-certificate'
import { htmlStructure } from './technical-foundation/html-structure'
import { mobileFriendly } from './technical-foundation/mobile-friendly'
import { javascriptRendering } from './technical-foundation/javascript-rendering'
import { contentAccessibility } from './technical-foundation/content-accessibility'

// Content Structure checks
import { faqSection } from './content-structure/faq-section'
import { definitionBoxes } from './content-structure/definition-boxes'
import { comparisonTables } from './content-structure/comparison-tables'
import { stepByStepGuides } from './content-structure/step-by-step-guides'
import { summarySections } from './content-structure/summary-sections'
import { citationFormat } from './content-structure/citation-format'

// Content Quality checks
import { contentDepth } from './content-quality/content-depth'
import { readability } from './content-quality/readability'
import { paragraphStructure } from './content-quality/paragraph-structure'
import { listUsage } from './content-quality/list-usage'
import { mediaRichness } from './content-quality/media-richness'
import { internalLinking } from './content-quality/internal-linking'

export const allAIOChecks: AIOCheckDefinition[] = [
  // Technical Foundation - Critical
  aiCrawlerAccess,
  schemaMarkup,
  sslCertificate,

  // Technical Foundation - Recommended
  pageSpeed,
  htmlStructure,
  mobileFriendly,
  javascriptRendering,
  contentAccessibility,

  // Content Structure - Recommended
  faqSection,
  definitionBoxes,
  stepByStepGuides,
  summarySections,
  citationFormat,

  // Content Structure - Optional
  comparisonTables,

  // Content Quality - Recommended
  contentDepth,
  readability,
  paragraphStructure,
  listUsage,
  internalLinking,

  // Content Quality - Optional
  mediaRichness,
]

export function getChecksByCategory(
  category: 'technical_foundation' | 'content_structure' | 'content_quality'
): AIOCheckDefinition[] {
  return allAIOChecks.filter((check) => check.category === category)
}

// Site-wide checks run once per audit (not per page)
export const siteWideChecks = allAIOChecks.filter((check) => check.isSiteWide)

// Page-specific checks run on each crawled page
export const pageSpecificChecks = allAIOChecks.filter((check) => !check.isSiteWide)
