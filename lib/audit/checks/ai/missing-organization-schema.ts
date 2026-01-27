import * as cheerio from 'cheerio'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingOrganizationSchema: AuditCheckDefinition = {
  name: 'missing_organization_schema',
  type: CheckType.AIReadiness,
  priority: CheckPriority.Recommended,
  description: 'Organization schema helps AI understand your business identity',
  displayName: 'Missing Organization Schema',
  displayNamePassed: 'Organization Schema',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/structured-data/organization',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    // This is a site-wide check that runs once on the homepage
    const pageUrl = new URL(context.url)
    const $ = cheerio.load(context.html)
    const jsonLdScripts = $('script[type="application/ld+json"]')

    let organizationFound = false
    let orgName: string | undefined
    const missingFields: string[] = []

    jsonLdScripts.each((_, el) => {
      try {
        const json = JSON.parse($(el).text())

        // Handle @graph structure
        const items = json['@graph'] ? json['@graph'] : [json]

        for (const item of items) {
          if (
            item['@type'] === 'Organization' ||
            item['@type'] === 'LocalBusiness' ||
            item['@type'] === 'Corporation' ||
            (Array.isArray(item['@type']) && item['@type'].includes('Organization'))
          ) {
            organizationFound = true
            orgName = item.name as string | undefined

            // Check for recommended fields
            if (!item.name) missingFields.push('name')
            if (!item.url) missingFields.push('url')
            if (!item.logo) missingFields.push('logo')
            if (!item.description) missingFields.push('description')

            break
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    })

    if (organizationFound) {
      const displayName = orgName || 'Unknown'
      if (missingFields.length === 0) {
        return {
          status: CheckStatus.Passed,
          details: {
            message: `Organization schema found with name "${displayName}". AI assistants can identify your business.`,
            organization_name: displayName,
          },
        }
      }

      return {
        status: CheckStatus.Warning,
        details: {
          message: `Organization schema found but missing recommended fields: ${missingFields.join(', ')}. Add these for better AI understanding.`,
          missing_fields: missingFields,
          organization_name: displayName,
        },
      }
    }

    return {
      status: CheckStatus.Failed,
      details: {
        message:
          'No Organization schema found on homepage. Add JSON-LD structured data to help search engines and AI assistants understand your business identity, location, and contact information.',
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
  },
}
