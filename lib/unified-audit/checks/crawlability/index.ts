import type { AuditCheckDefinition } from '../../types'
import { robotsTxtValidation } from './robots-txt-validation'
import { robotsTxtSkippedPaths } from './robots-txt-skipped-paths'
import { aiCrawlerAccess } from './ai-crawler-access'
import { sitemapDetection } from './sitemap-detection'
import { noindexDetection } from './noindex-detection'
import { httpToHttpsRedirect } from './http-to-https-redirect'
import { llmsTxt } from './llms-txt'
import { jsRendering } from './js-rendering'

export const crawlabilityChecks: AuditCheckDefinition[] = [
  robotsTxtValidation,
  robotsTxtSkippedPaths,
  aiCrawlerAccess,
  sitemapDetection,
  noindexDetection,
  httpToHttpsRedirect,
  llmsTxt,
  jsRendering,
]

export {
  robotsTxtValidation,
  robotsTxtSkippedPaths,
  aiCrawlerAccess,
  sitemapDetection,
  noindexDetection,
  httpToHttpsRedirect,
  llmsTxt,
  jsRendering,
}
