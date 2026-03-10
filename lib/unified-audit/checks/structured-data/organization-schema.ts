import * as cheerio from 'cheerio'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type {
  AuditCheckDefinition,
  CheckContext,
  CheckResult,
  OrganizationSchemaDetails,
} from '../../types'

const SOCIAL_PLATFORMS: Record<string, string> = {
  'linkedin.com': 'LinkedIn',
  'twitter.com': 'Twitter/X',
  'x.com': 'Twitter/X',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'youtube.com': 'YouTube',
  'github.com': 'GitHub',
  'tiktok.com': 'TikTok',
  'pinterest.com': 'Pinterest',
}

function classifySameAsLinks(links: string[]): {
  platforms: string[]
  hasSocialProfiles: boolean
  hasWikipedia: boolean
  hasWikidata: boolean
} {
  const platforms: string[] = []
  let hasWikipedia = false
  let hasWikidata = false

  for (const link of links) {
    try {
      const url = new URL(link)
      const hostname = url.hostname.replace('www.', '')

      if (hostname.includes('wikipedia.org')) {
        hasWikipedia = true
      } else if (hostname.includes('wikidata.org')) {
        hasWikidata = true
      }

      for (const [domain, platform] of Object.entries(SOCIAL_PLATFORMS)) {
        if (hostname.includes(domain) && !platforms.includes(platform)) {
          platforms.push(platform)
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return {
    platforms,
    hasSocialProfiles: platforms.length > 0,
    hasWikipedia,
    hasWikidata,
  }
}

export const organizationSchema: AuditCheckDefinition = {
  name: 'organization_schema',
  category: CheckCategory.StructuredData,
  priority: CheckPriority.Recommended,
  description: 'Organization schema helps search engines and AI understand your business identity',
  displayName: 'Missing Organization Schema',
  displayNamePassed: 'Organization Schema',
  learnMoreUrl:
    'https://developers.google.com/search/docs/appearance/structured-data/organization',
  isSiteWide: true,
  fixGuidance:
    'Add Organization JSON-LD structured data to your homepage with name, url, logo, description, and sameAs links to social profiles.',
  feedsScores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)
    const jsonLdScripts = $('script[type="application/ld+json"]')

    let orgFound = false
    let hasName = false
    let hasUrl = false
    let hasLogo = false
    let hasDescription = false
    let sameAsLinks: string[] = []

    jsonLdScripts.each((_, el) => {
      if (orgFound) return

      try {
        const content = $(el).html()
        if (!content) return

        const json = JSON.parse(content)

        // Handle @graph structure
        const items = json['@graph'] ? json['@graph'] : [json]

        for (const item of items) {
          const itemType = item['@type']
          const isOrg =
            itemType === 'Organization' ||
            itemType === 'LocalBusiness' ||
            itemType === 'Corporation' ||
            (Array.isArray(itemType) && itemType.includes('Organization'))

          if (isOrg) {
            orgFound = true
            hasName = Boolean(item.name)
            hasUrl = Boolean(item.url)
            hasLogo = Boolean(item.logo)
            hasDescription = Boolean(item.description)

            if (Array.isArray(item.sameAs)) {
              sameAsLinks = item.sameAs.filter(
                (link: unknown) => typeof link === 'string'
              )
            } else if (typeof item.sameAs === 'string') {
              sameAsLinks = [item.sameAs]
            }

            break
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    })

    const sameAsAnalysis = classifySameAsLinks(sameAsLinks)

    const orgDetails: OrganizationSchemaDetails = {
      exists: orgFound,
      hasName,
      hasUrl,
      hasLogo,
      hasDescription,
      sameAs: {
        present: sameAsLinks.length > 0,
        links: sameAsLinks,
        platforms: sameAsAnalysis.platforms,
        hasSocialProfiles: sameAsAnalysis.hasSocialProfiles,
        hasWikipedia: sameAsAnalysis.hasWikipedia,
        hasWikidata: sameAsAnalysis.hasWikidata,
        count: sameAsLinks.length,
      },
    }

    if (!orgFound) {
      const pageUrl = new URL(context.url)
      return {
        status: CheckStatus.Failed,
        details: {
          ...(orgDetails as unknown as Record<string, unknown>),
          message:
            'No Organization schema found. Add JSON-LD structured data to help search engines and AI assistants understand your business identity.',
          suggestion: `Add this to your homepage <head>:
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company Name",
  "url": "${pageUrl.origin}",
  "logo": "${pageUrl.origin}/logo.png",
  "description": "Brief description of your business",
  "sameAs": [
    "https://www.linkedin.com/company/yourcompany",
    "https://twitter.com/yourcompany"
  ]
}
</script>`,
        },
      }
    }

    // Check for missing fields
    const missingFields: string[] = []
    if (!hasName) missingFields.push('name')
    if (!hasUrl) missingFields.push('url')
    if (!hasLogo) missingFields.push('logo')
    if (!hasDescription) missingFields.push('description')

    const warnings: string[] = []
    if (!sameAsAnalysis.hasSocialProfiles) {
      warnings.push('No social media profiles linked via sameAs')
    }
    if (!sameAsAnalysis.hasWikipedia) {
      warnings.push('No Wikipedia link — adding one strengthens knowledge graph presence')
    }

    if (missingFields.length > 0) {
      return {
        status: CheckStatus.Warning,
        details: {
          ...(orgDetails as unknown as Record<string, unknown>),
          message: `Organization schema found but missing recommended fields: ${missingFields.join(', ')}.`,
          missingFields,
          warnings,
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: {
        ...(orgDetails as unknown as Record<string, unknown>),
        message: `Organization schema found with all key fields. ${sameAsLinks.length} sameAs link(s) detected.`,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    }
  },
}
