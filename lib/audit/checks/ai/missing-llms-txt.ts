import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingLlmsTxt: AuditCheckDefinition = {
  name: 'missing_llms_txt',
  type: CheckType.AIReadiness,
  priority: CheckPriority.Critical,
  description: 'Check if /llms.txt exists for AI crawlers',
  displayName: 'Missing llms.txt File',
  displayNamePassed: 'llms.txt File',
  learnMoreUrl: 'https://llmstxt.org/',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    // This is a site-wide check - only meaningful on homepage
    const baseUrl = new URL(context.url)
    if (baseUrl.pathname !== '/' && baseUrl.pathname !== '') {
      return { status: CheckStatus.Passed } // Skip for non-homepage
    }

    try {
      const llmsTxtUrl = `${baseUrl.origin}/llms.txt`
      const response = await fetch(llmsTxtUrl, { method: 'HEAD' })
      if (response.ok) {
        return {
          status: CheckStatus.Passed,
          details: { message: 'Found at /llms.txt' },
        }
      }
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Create a /llms.txt file to help AI assistants understand your site. This file describes your content in a format optimized for language models.',
        },
      }
    } catch {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Create a /llms.txt file to help AI assistants understand your site. This file describes your content in a format optimized for language models.',
        },
      }
    }
  },
}
