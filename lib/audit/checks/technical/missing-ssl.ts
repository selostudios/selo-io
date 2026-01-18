import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const missingSsl: AuditCheckDefinition = {
  name: 'missing_ssl',
  type: 'technical',
  priority: 'critical',
  description: 'Sites not using HTTPS encryption',

  async run(context: CheckContext): Promise<CheckResult> {
    const url = new URL(context.url)

    if (url.protocol !== 'https:') {
      return {
        status: 'failed',
        details: {
          message: 'Site is not using HTTPS',
        },
      }
    }

    return { status: 'passed' }
  },
}
