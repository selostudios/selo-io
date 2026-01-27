import type { AIOCheckDefinition, AIOCheckContext, CheckResult } from '@/lib/aio/types'

export const pageSpeed: AIOCheckDefinition = {
  name: 'page_speed',
  category: 'technical_foundation',
  priority: 'recommended',
  description: 'Fast page loads improve AI crawler efficiency and user experience',
  displayName: 'Slow Page Load',
  displayNamePassed: 'Fast Page Load',
  learnMoreUrl: 'https://web.dev/articles/vitals',
  isSiteWide: false,
  fixGuidance: 'Optimize images, reduce JavaScript, enable compression, and use a CDN.',

  async run(context: AIOCheckContext): Promise<CheckResult> {
    // We'll measure a simple response time as a proxy
    // In a more advanced implementation, this could integrate with Web Vitals API
    const startTime = Date.now()

    try {
      const response = await fetch(context.url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SeloGEOBot/1.0)',
        },
      })

      const responseTime = Date.now() - startTime

      if (!response.ok) {
        return {
          status: 'warning',
          details: { message: 'Could not measure page speed (non-200 response)' },
        }
      }

      // Thresholds based on Core Web Vitals guidelines
      // Good: < 1s, Needs improvement: 1-2.5s, Poor: > 2.5s
      if (responseTime < 1000) {
        return {
          status: 'passed',
          details: {
            message: `Excellent response time: ${responseTime}ms`,
            responseTime,
          },
        }
      } else if (responseTime < 2500) {
        return {
          status: 'warning',
          details: {
            message: `Moderate response time: ${responseTime}ms. Consider optimization for better AI crawler performance.`,
            responseTime,
          },
        }
      } else {
        return {
          status: 'failed',
          details: {
            message: `Slow response time: ${responseTime}ms. This may impact AI crawler efficiency and content indexing.`,
            responseTime,
          },
        }
      }
    } catch (error) {
      return {
        status: 'warning',
        details: {
          message: `Could not measure page speed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      }
    }
  },
}
