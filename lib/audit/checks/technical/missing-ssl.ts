import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'
import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'

export const missingSsl: AuditCheckDefinition = {
  name: 'missing_ssl',
  type: CheckType.Technical,
  priority: CheckPriority.Critical,
  description: 'Sites not using HTTPS encryption',
  displayName: 'Missing HTTPS',
  displayNamePassed: 'HTTPS Enabled',
  learnMoreUrl: 'https://developers.google.com/search/docs/fundamentals/security',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const url = new URL(context.url)

    if (url.protocol !== 'https:') {
      return {
        status: CheckStatus.Failed,
        details: {
          message:
            'Site is served over HTTP instead of HTTPS. HTTPS is required for security and is a Google ranking factor. Enable SSL/TLS encryption on your server.',
        },
      }
    }

    return {
      status: CheckStatus.Passed,
      details: { message: 'Site is served over HTTPS' },
    }
  },
}
