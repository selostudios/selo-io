import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type {
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  BrandMentionDetails,
} from '../../types'

function extractBrandName($: cheerio.CheerioAPI, url: string): string {
  // Try JSON-LD Organization schema
  const jsonLdScripts = $('script[type="application/ld+json"]')
  for (let i = 0; i < jsonLdScripts.length; i++) {
    try {
      const data = JSON.parse($(jsonLdScripts[i]).html() || '')
      if (data['@type'] === 'Organization' && data.name) {
        return data.name
      }
      // Handle array of schemas
      if (Array.isArray(data)) {
        const org = data.find((d: Record<string, unknown>) => d['@type'] === 'Organization')
        if (org?.name) return org.name as string
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  // Try title tag (first segment before separator)
  const title = $('title').text().trim()
  if (title) {
    const segments = title.split(/\s*[-|]\s*/)
    if (segments[0]?.trim()) {
      return segments[0].trim()
    }
  }

  // Fall back to domain name
  try {
    const hostname = new URL(url).hostname
    const parts = hostname.replace('www.', '').split('.')
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  } catch {
    return 'Unknown'
  }
}

export const brandMentions: AuditCheckDefinition = {
  name: 'brand_mentions',
  category: CheckCategory.AIVisibility,
  priority: CheckPriority.Optional,
  description:
    'Checks if your brand has presence in knowledge bases like Wikipedia and Wikidata that AI models rely on',
  displayName: 'Low Brand Visibility',
  displayNamePassed: 'Good Brand Visibility',
  learnMoreUrl: null,
  isSiteWide: true,
  feedsScores: [ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const brandName = extractBrandName($, context.url)
    const gaps: string[] = []

    // Check Wikipedia
    let wikipedia: BrandMentionDetails['wikipedia'] = { found: false }
    try {
      const wikiResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(brandName)}&prop=extracts&exintro=true&format=json`,
        { headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' } }
      )
      if (wikiResponse.ok) {
        const wikiData = (await wikiResponse.json()) as {
          query?: {
            pages?: Record<
              string,
              { pageid?: number; title?: string; extract?: string; missing?: string }
            >
          }
        }
        const pages = wikiData.query?.pages
        if (pages) {
          const pageId = Object.keys(pages)[0]
          const page = pages[pageId]
          if (page && !page.missing && page.pageid) {
            wikipedia = {
              found: true,
              articleUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title || brandName)}`,
              extract: page.extract?.slice(0, 500),
              pageId: page.pageid,
            }
          }
        }
      }
    } catch {
      // API call failed, treat as not found
    }

    if (!wikipedia.found) {
      gaps.push('No Wikipedia article found for this brand')
    }

    // Check Wikidata
    let wikidata: BrandMentionDetails['wikidata'] = { found: false }
    try {
      const wdResponse = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brandName)}&language=en&format=json`,
        { headers: { 'User-Agent': 'SeloBot/1.0 (Site Audit)' } }
      )
      if (wdResponse.ok) {
        const wdData = (await wdResponse.json()) as {
          search?: {
            id?: string
            url?: string
            description?: string
            concepturi?: string
          }[]
        }
        if (wdData.search && wdData.search.length > 0) {
          const entity = wdData.search[0]
          wikidata = {
            found: true,
            entityId: entity.id,
            entityUrl: entity.url || entity.concepturi,
            description: entity.description,
          }
        }
      }
    } catch {
      // API call failed, treat as not found
    }

    if (!wikidata.found) {
      gaps.push('No Wikidata entity found for this brand')
    }

    const knowledgeGraphPresence = wikipedia.found || wikidata.found

    const details: BrandMentionDetails = {
      brandName,
      wikipedia,
      wikidata,
      knowledgeGraphPresence,
      gaps,
    }

    if (wikipedia.found) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: `Brand "${brandName}" has Wikipedia presence — strong signal for AI knowledge bases`,
          ...(details as unknown as Record<string, unknown>),
        },
      }
    } else if (wikidata.found) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: `Brand "${brandName}" found in Wikidata but not Wikipedia — consider creating a Wikipedia article`,
          fixGuidance:
            'Create a Wikipedia article for your brand to improve visibility in AI knowledge bases.',
          ...(details as unknown as Record<string, unknown>),
        },
      }
    } else {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Brand "${brandName}" not found in Wikipedia or Wikidata — low visibility in AI knowledge bases`,
          fixGuidance:
            'Establish your brand in knowledge bases by creating a Wikidata entity and working towards a Wikipedia article.',
          ...(details as unknown as Record<string, unknown>),
        },
      }
    }
  },
}
