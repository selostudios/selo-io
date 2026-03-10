import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/unified-audit/types'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

export const duplicateTitles: AuditCheckDefinition = {
  name: 'duplicate_titles',
  category: CheckCategory.MetaContent,
  feedsScores: [ScoreDimension.SEO],
  priority: CheckPriority.Critical,
  description: 'Duplicate page titles confuse search engines and reduce click-through rates',
  displayName: 'Duplicate Page Titles',
  displayNamePassed: 'Unique Page Titles',
  learnMoreUrl: 'https://developers.google.com/search/docs/appearance/title-link',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    if (!context.allPages) {
      return { status: CheckStatus.Passed, details: { message: 'No pages to compare' } }
    }

    // Group pages by title
    const titleToUrls: Record<string, string[]> = {}

    for (const page of context.allPages) {
      if ((page.statusCode ?? 200) >= 400) continue // Skip error pages
      const title = page.title?.trim()
      if (!title) continue // Skip pages without titles (handled by missing_title check)

      if (!titleToUrls[title]) {
        titleToUrls[title] = []
      }
      titleToUrls[title].push(page.url)
    }

    // Find duplicate titles (more than one URL with same title)
    const duplicates = Object.entries(titleToUrls)
      .filter(([, urls]) => urls.length > 1)
      .map(([title, urls]) => ({ title, urls, count: urls.length }))
      .sort((a, b) => b.count - a.count)

    const totalDuplicatePages = duplicates.reduce((sum, d) => sum + d.count, 0)

    if (duplicates.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: 'All page titles are unique',
          uniqueTitles: Object.keys(titleToUrls).length,
        },
      }
    }

    // Create summary of duplicates
    const summary = duplicates
      .slice(0, 3)
      .map((d) => `"${d.title.slice(0, 40)}${d.title.length > 40 ? '...' : ''}" (${d.count} pages)`)
      .join(', ')

    return {
      status: CheckStatus.Failed,
      details: {
        message: `Found ${duplicates.length} duplicate title${duplicates.length > 1 ? 's' : ''} affecting ${totalDuplicatePages} pages. Examples: ${summary}. Each page should have a unique, descriptive title.`,
        duplicateCount: duplicates.length,
        affectedPages: totalDuplicatePages,
        duplicates: duplicates.map((d) => ({
          title: d.title,
          urls: d.urls,
          count: d.count,
        })),
      },
    }
  },
}
