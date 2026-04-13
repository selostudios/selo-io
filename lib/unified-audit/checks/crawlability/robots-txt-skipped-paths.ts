import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const robotsTxtSkippedPaths: AuditCheckDefinition = {
  name: 'robots_txt_skipped_paths',
  category: CheckCategory.Crawlability,
  priority: CheckPriority.Recommended,
  description: 'Paths skipped during crawling due to robots.txt Disallow rules',
  displayName: 'Paths Blocked by robots.txt',
  displayNamePassed: 'No Paths Blocked by robots.txt',
  isSiteWide: true,
  fixGuidance:
    'These paths were not audited because robots.txt disallows crawling them. If these paths contain important content, update your robots.txt to allow access.',
  feedsScores: [ScoreDimension.SEO],

  async run(context: CheckContext): Promise<CheckResult> {
    const rules = context.robotsTxtRules

    // No robots.txt rules — nothing was skipped
    if (!rules || rules.rules.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          skippedPaths: [],
        },
      }
    }

    // Extract all Disallow paths (these are the paths we skipped)
    const disallowedPaths = rules.rules
      .filter((r) => r.type === 'disallow')
      .map((r) => r.path)
      .filter((p) => p && p !== '')

    if (disallowedPaths.length === 0) {
      return {
        status: CheckStatus.Passed,
        details: {
          message: undefined,
          skippedPaths: [],
        },
      }
    }

    return {
      status: CheckStatus.Warning,
      details: {
        message: `${disallowedPaths.length} path${disallowedPaths.length === 1 ? '' : 's'} blocked by robots.txt and not audited: ${disallowedPaths.join(', ')}`,
        skippedPaths: disallowedPaths,
        note: "These paths were excluded from the audit because the site's robots.txt file disallows crawling them.",
      },
    }
  },
}
