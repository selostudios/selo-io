import * as cheerio from 'cheerio'
import { AIOCheckCategory, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const comparisonTables: AIOCheckDefinition = {
  name: 'comparison_tables',
  category: AIOCheckCategory.ContentStructure,
  priority: CheckPriority.Optional,
  description: 'Structured data tables help AI engines extract comparative information',
  displayName: 'No Comparison Tables',
  displayNamePassed: 'Comparison Tables Present',
  learnMoreUrl: 'https://web.dev/articles/accessible-tables',
  isSiteWide: false,

  async run(context: AIOCheckContext): Promise<CheckResult> {
    const $ = cheerio.load(context.html)

    // Find tables
    const tables = $('table')

    if (tables.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: 'No tables found (not applicable for this page type)',
        },
      }
    }

    // Check for well-structured tables with headers
    const tablesWithHeaders = tables.filter((_, el) => {
      return $(el).find('th').length > 0
    })

    // Check for tables with captions (good for accessibility and AI understanding)
    const tablesWithCaptions = tables.filter((_, el) => {
      return $(el).find('caption').length > 0
    })

    // Check for comparison-related content near tables
    const headings = $('h1, h2, h3, h4, h5, h6').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return /comparison|compare|vs|versus|difference|pricing/.test(text)
    })

    if (tablesWithHeaders.length === 0) {
      return {
        status: CheckStatus.Failed,
        details: {
          message: `Found ${tables.length} table(s) but none have header rows (<th>). AI engines need structured tables to extract data.`,
          totalTables: tables.length,
          fixGuidance: 'Add <th> elements to define column/row headers in your tables.',
        },
      }
    } else {
      const features = []
      features.push(`${tablesWithHeaders.length} table(s) with headers`)
      if (tablesWithCaptions.length > 0) {
        features.push(`${tablesWithCaptions.length} with captions`)
      }
      if (headings.length > 0) {
        features.push(`comparison context headings`)
      }

      return {
        status: CheckStatus.Passed,
        details: {
          message: `Structured tables found: ${features.join(', ')}`,
          totalTables: tables.length,
          tablesWithHeaders: tablesWithHeaders.length,
          features,
        },
      }
    }
  },
}
