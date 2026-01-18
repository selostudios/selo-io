import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingLlmsTxt: AuditCheckDefinition = {
  name: 'missing_llms_txt',
  type: 'ai_readiness',
  priority: 'critical',
  description: 'Check if /llms.txt exists for AI crawlers',

  async run(context: CheckContext): Promise<CheckResult> {
    // This is a site-wide check - only meaningful on homepage
    const baseUrl = new URL(context.url)
    if (baseUrl.pathname !== '/' && baseUrl.pathname !== '') {
      return { status: 'passed' } // Skip for non-homepage
    }

    try {
      const llmsTxtUrl = `${baseUrl.origin}/llms.txt`
      const response = await fetch(llmsTxtUrl, { method: 'HEAD' })
      if (response.ok) {
        return { status: 'passed' }
      }
      return {
        status: 'failed',
        details: { message: 'No llms.txt file found at /llms.txt' },
      }
    } catch {
      return { status: 'failed', details: { message: 'Could not check for llms.txt' } }
    }
  },
}
