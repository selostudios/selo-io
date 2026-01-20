import type { AuditCheckDefinition } from '@/lib/audit/types'
// SEO checks
import { missingMetaDescription } from './seo/missing-meta-description'
import { metaDescriptionLength } from './seo/meta-description-length'
import { missingTitle } from './seo/missing-title'
import { titleLength } from './seo/title-length'
import { missingH1 } from './seo/missing-h1'
import { multipleH1 } from './seo/multiple-h1'
import { headingHierarchy } from './seo/heading-hierarchy'
import { imagesMissingAlt } from './seo/images-missing-alt'
import { missingCanonical } from './seo/missing-canonical'
import { thinContent } from './seo/thin-content'
import { missingSitemap } from './seo/missing-sitemap'
import { nonDescriptiveUrl } from './seo/non-descriptive-url'
import { oversizedImages } from './seo/oversized-images'
import { brokenInternalLinks } from './seo/broken-internal-links'
import { missingRobotsTxt } from './seo/missing-robots-txt'
import { duplicateTitles } from './seo/duplicate-titles'
// AI-Readiness checks
import { missingLlmsTxt } from './ai/missing-llms-txt'
import { aiCrawlersBlocked } from './ai/ai-crawlers-blocked'
import { missingStructuredData } from './ai/missing-structured-data'
import { noFaqContent } from './ai/no-faq-content'
import { slowPageResponse } from './ai/slow-page-response'
import { jsRenderedContent } from './ai/js-rendered-content'
import { missingOrganizationSchema } from './ai/missing-organization-schema'
import { noRecentUpdates } from './ai/no-recent-updates'
import { missingMarkdown } from './ai/missing-markdown'
// Technical checks
import { missingSsl } from './technical/missing-ssl'
import { missingViewport } from './technical/missing-viewport'
import { missingOgTags } from './technical/missing-og-tags'
import { missingFavicon } from './technical/missing-favicon'
import { mixedContent } from './technical/mixed-content'

export const allChecks: AuditCheckDefinition[] = [
  // SEO - Critical
  missingMetaDescription,
  missingTitle,
  missingH1,
  missingSitemap,
  brokenInternalLinks,
  missingRobotsTxt,
  duplicateTitles,
  // SEO - Recommended
  metaDescriptionLength,
  titleLength,
  multipleH1,
  headingHierarchy,
  imagesMissingAlt,
  missingCanonical,
  nonDescriptiveUrl,
  // SEO - Optional
  thinContent,
  oversizedImages,
  // AI-Readiness - Critical
  missingLlmsTxt,
  aiCrawlersBlocked,
  missingStructuredData,
  slowPageResponse,
  jsRenderedContent,
  // AI-Readiness - Recommended
  noFaqContent,
  missingOrganizationSchema,
  noRecentUpdates,
  // AI-Readiness - Optional
  missingMarkdown,
  // Technical - Critical
  missingSsl,
  // Technical - Recommended
  missingViewport,
  mixedContent,
  // Technical - Optional
  missingOgTags,
  missingFavicon,
]

export function getChecksByType(
  type: 'seo' | 'ai_readiness' | 'technical'
): AuditCheckDefinition[] {
  return allChecks.filter((check) => check.type === type)
}

// Site-wide checks run once per audit (not per page)
export const siteWideChecks = allChecks.filter((check) => check.isSiteWide)

// Page-specific checks run on each crawled page
export const pageSpecificChecks = allChecks.filter((check) => !check.isSiteWide)
