import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const duplicateMetaDescriptions: AuditCheckDefinition = {
  name: 'duplicate_meta_descriptions',
  type: 'seo',
  priority: 'recommended',
  description: 'Duplicate meta descriptions reduce click-through rates from search results',
  displayName: 'Duplicate Meta Descriptions',
  displayNamePassed: 'Unique Meta Descriptions',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/snippet',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    // Group pages by meta description
    const descriptionToUrls: Record<string, string[]> = {}

    for (const page of context.allPages) {
      // Skip resources (PDFs, images, etc.)
      if (page.is_resource) continue

      const description = page.meta_description?.trim()
      if (!description) continue // Skip pages without meta descriptions (handled by missing_meta_description check)

      if (!descriptionToUrls[description]) {
        descriptionToUrls[description] = []
      }
      descriptionToUrls[description].push(page.url)
    }

    // Find duplicate descriptions (more than one URL with same description)
    const duplicates = Object.entries(descriptionToUrls)
      .filter(([, urls]) => urls.length > 1)
      .map(([description, urls]) => ({ description, urls, count: urls.length }))
      .sort((a, b) => b.count - a.count)

    const totalDuplicatePages = duplicates.reduce((sum, d) => sum + d.count, 0)

    if (duplicates.length === 0) {
      return {
        status: 'passed',
        details: {
          message: 'All meta descriptions are unique',
          uniqueDescriptions: Object.keys(descriptionToUrls).length,
        },
      }
    }

    // Create summary of duplicates
    const summary = duplicates
      .slice(0, 3)
      .map(
        (d) =>
          `"${d.description.slice(0, 50)}${d.description.length > 50 ? '...' : ''}" (${d.count} pages)`
      )
      .join(', ')

    return {
      status: 'warning',
      details: {
        message: `Found ${duplicates.length} duplicate meta description${duplicates.length > 1 ? 's' : ''} affecting ${totalDuplicatePages} pages. Examples: ${summary}. Each page should have a unique meta description to improve click-through rates.`,
        duplicateCount: duplicates.length,
        affectedPages: totalDuplicatePages,
        duplicates: duplicates.slice(0, 10).map((d) => ({
          description: d.description,
          urls: d.urls.slice(0, 5),
          count: d.count,
        })),
      },
    }
  },
}
