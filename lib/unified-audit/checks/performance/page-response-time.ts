import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const pageResponseTime: AuditCheckDefinition = {
  name: 'page_response_time',
  category: CheckCategory.Performance,
  priority: CheckPriority.Critical,
  description:
    'Pages that load slowly hurt user experience and AI crawler efficiency. LCP under 3s is good, 3-5s needs improvement, over 5s is poor.',
  displayName: 'Slow Page Response',
  displayNamePassed: 'Fast Page Response',
  learnMoreUrl: 'https://web.dev/articles/lcp',
  isSiteWide: false,
  fixGuidance:
    'Optimize server response time, enable compression, use a CDN, and reduce render-blocking resources.',
  feedsScores: [ScoreDimension.Performance, ScoreDimension.AIReadiness],

  async run(context: CheckContext): Promise<CheckResult> {
    // Try PSI data first (most accurate)
    const psi = context.psiData as Record<string, unknown> | undefined
    if (psi) {
      const lcpMs = extractLcpFromPsi(psi)
      if (lcpMs !== null) {
        const lcpSeconds = (lcpMs / 1000).toFixed(2)
        const opportunities = context.psiOpportunities ?? []
        const opportunitySuffix =
          opportunities.length > 0
            ? ` Top issues: ${opportunities.map((o) => `${o.title} (${o.displayValue})`).join(', ')}.`
            : ''

        if (lcpMs <= 3000) {
          return {
            status: CheckStatus.Passed,
            details: {
              message: undefined,
              lcp_ms: lcpMs,
              source: 'psi',
            },
          }
        }

        if (lcpMs <= 5000) {
          return {
            status: CheckStatus.Warning,
            details: {
              message: `Page LCP is ${lcpSeconds}s — aim for under 3s.${opportunitySuffix}`,
              lcp_ms: lcpMs,
              source: 'psi',
              opportunities,
            },
          }
        }

        return {
          status: CheckStatus.Failed,
          details: {
            message: `Page LCP is ${lcpSeconds}s — too slow for AI crawlers and users.${opportunitySuffix}`,
            lcp_ms: lcpMs,
            source: 'psi',
            opportunities,
          },
        }
      }
    }

    // Fallback: measure response time directly
    const startTime = performance.now()

    try {
      await fetch(context.url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SeloAuditBot/1.0)',
        },
      })

      const responseTimeMs = Math.round(performance.now() - startTime)
      const responseTimeSeconds = (responseTimeMs / 1000).toFixed(2)

      if (responseTimeMs <= 3000) {
        return {
          status: CheckStatus.Passed,
          details: {
            message: undefined,
            response_time_ms: responseTimeMs,
            source: 'fetch',
          },
        }
      }

      if (responseTimeMs <= 5000) {
        return {
          status: CheckStatus.Warning,
          details: {
            message: `Page responds in ${responseTimeSeconds}s — consider optimizing for faster load times.`,
            response_time_ms: responseTimeMs,
            source: 'fetch',
          },
        }
      }

      return {
        status: CheckStatus.Failed,
        details: {
          message: `Page takes ${responseTimeSeconds}s to respond — too slow for AI crawlers and users.`,
          response_time_ms: responseTimeMs,
          source: 'fetch',
        },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        return {
          status: CheckStatus.Failed,
          details: {
            message:
              'Page took over 10 seconds to respond (timed out). AI crawlers will skip this page.',
            source: 'fetch',
          },
        }
      }

      return {
        status: CheckStatus.Failed,
        details: {
          message: `Could not measure response time: ${errorMessage}`,
          source: 'fetch',
        },
      }
    }
  },
}

function extractLcpFromPsi(psi: Record<string, unknown>): number | null {
  try {
    // Try loadingExperience path (field data)
    const loadingExperience = psi.loadingExperience as Record<string, unknown> | undefined
    if (loadingExperience?.metrics) {
      const metrics = loadingExperience.metrics as Record<string, unknown>
      const lcp = metrics.LARGEST_CONTENTFUL_PAINT_MS as Record<string, unknown> | undefined
      if (lcp?.percentile !== undefined) {
        return Number(lcp.percentile)
      }
    }

    // Try lighthouseResult path (lab data)
    const lighthouseResult = psi.lighthouseResult as Record<string, unknown> | undefined
    if (lighthouseResult?.audits) {
      const audits = lighthouseResult.audits as Record<string, unknown>
      const lcpAudit = audits['largest-contentful-paint'] as Record<string, unknown> | undefined
      if (lcpAudit?.numericValue !== undefined) {
        return Number(lcpAudit.numericValue)
      }
    }

    // Try direct lcp property (pre-normalized data)
    if (psi.lcp !== undefined) {
      return Number(psi.lcp)
    }

    return null
  } catch {
    return null
  }
}
