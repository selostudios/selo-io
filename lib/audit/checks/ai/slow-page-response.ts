import { CheckType, CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '@/lib/audit/types'

export const slowPageResponse: AuditCheckDefinition = {
  name: 'slow_page_response',
  type: CheckType.AIReadiness,
  priority: CheckPriority.Critical,
  description: 'AI crawlers timeout on slow pages (1-5 seconds)',
  displayName: 'Slow Page Response',
  displayNamePassed: 'Fast Page Response',
  learnMoreUrl:
    'https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget',
  isSiteWide: true,

  async run(context: CheckContext): Promise<CheckResult> {
    const baseUrl = new URL(context.url).origin

    // Measure response time to the homepage
    const startTime = performance.now()

    try {
      await fetch(baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000), // 10 second max timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AuditBot/1.0)',
        },
      })

      const endTime = performance.now()
      const responseTimeMs = Math.round(endTime - startTime)
      const responseTimeSeconds = (responseTimeMs / 1000).toFixed(2)

      // AI crawlers typically timeout at 1-5 seconds
      // We use 2 seconds as good, 5 seconds as warning threshold
      if (responseTimeMs <= 2000) {
        return {
          status: CheckStatus.Passed,
          details: {
            message: `Homepage responds in ${responseTimeSeconds}s. AI crawlers can access your content quickly.`,
            response_time_ms: responseTimeMs,
          },
        }
      }

      if (responseTimeMs <= 5000) {
        return {
          status: CheckStatus.Warning,
          details: {
            message: `Homepage responds in ${responseTimeSeconds}s. This is within limits but AI crawlers like GPTBot prefer faster responses (<2s). Consider optimizing server response time.`,
            response_time_ms: responseTimeMs,
          },
        }
      }

      return {
        status: CheckStatus.Failed,
        details: {
          message: `Homepage takes ${responseTimeSeconds}s to respond. AI crawlers typically timeout at 5 seconds and may skip your content. Optimize server response time, enable caching, or use a CDN.`,
          response_time_ms: responseTimeMs,
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        return {
          status: CheckStatus.Failed,
          details: {
            message:
              'Homepage took over 10 seconds to respond (timed out). AI crawlers will skip your site. This is a critical performance issue.',
          },
        }
      }

      return {
        status: CheckStatus.Failed,
        details: {
          message: `Could not measure response time: ${errorMessage}`,
        },
      }
    }
  },
}
