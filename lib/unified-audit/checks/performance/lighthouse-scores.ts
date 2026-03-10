import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

export const lighthouseScores: AuditCheckDefinition = {
  name: 'lighthouse_scores',
  category: CheckCategory.Performance,
  priority: CheckPriority.Critical,
  description:
    'Lighthouse performance score reflects overall page load quality. 90+ is good, 50-89 needs improvement, below 50 is poor.',
  displayName: 'Poor Lighthouse Score',
  displayNamePassed: 'Good Lighthouse Score',
  learnMoreUrl: 'https://developer.chrome.com/docs/lighthouse/performance/performance-scoring',
  isSiteWide: false,
  fixGuidance:
    'Address the specific Lighthouse audit recommendations: optimize images, reduce unused JavaScript, improve server response time.',
  feedsScores: [ScoreDimension.Performance],

  async run(context: CheckContext): Promise<CheckResult> {
    const psi = context.psiData as Record<string, unknown> | undefined

    if (!psi) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: 'No PageSpeed Insights data available to evaluate Lighthouse scores.',
        },
      }
    }

    const scores = extractLighthouseScores(psi)

    if (scores === null) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: 'Could not extract Lighthouse scores from PSI data.',
        },
      }
    }

    const { performance, accessibility, bestPractices, seo } = scores

    // Primary assessment based on performance score
    let status: CheckStatus
    if (performance >= 90) {
      status = CheckStatus.Passed
    } else if (performance >= 50) {
      status = CheckStatus.Warning
    } else {
      status = CheckStatus.Failed
    }

    const labels: Record<string, string> = {}
    for (const [key, value] of Object.entries(scores)) {
      if (value >= 90) labels[key] = 'good'
      else if (value >= 50) labels[key] = 'needs improvement'
      else labels[key] = 'poor'
    }

    return {
      status,
      details: {
        message: `Lighthouse performance: ${performance}/100 (${labels.performance}). Accessibility: ${accessibility}/100, Best Practices: ${bestPractices}/100, SEO: ${seo}/100.`,
        performance,
        accessibility,
        bestPractices,
        seo,
        labels,
      },
    }
  },
}

interface LighthouseScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

function extractLighthouseScores(psi: Record<string, unknown>): LighthouseScores | null {
  try {
    // Try direct properties (pre-normalized)
    if (
      typeof psi.performance === 'number' &&
      typeof psi.accessibility === 'number' &&
      typeof psi.bestPractices === 'number' &&
      typeof psi.seo === 'number'
    ) {
      return {
        performance: psi.performance as number,
        accessibility: psi.accessibility as number,
        bestPractices: psi.bestPractices as number,
        seo: psi.seo as number,
      }
    }

    // Try lighthouseResult.categories path (raw PSI response)
    const lighthouseResult = psi.lighthouseResult as Record<string, unknown> | undefined
    if (lighthouseResult?.categories) {
      const categories = lighthouseResult.categories as Record<string, unknown>
      const perf = categories.performance as Record<string, unknown> | undefined
      const a11y = categories.accessibility as Record<string, unknown> | undefined
      const bp = categories['best-practices'] as Record<string, unknown> | undefined
      const seoCategory = categories.seo as Record<string, unknown> | undefined

      if (perf?.score !== undefined) {
        return {
          // Lighthouse returns scores as 0-1 fractions
          performance: Math.round(Number(perf.score) * 100),
          accessibility: a11y?.score !== undefined ? Math.round(Number(a11y.score) * 100) : 0,
          bestPractices: bp?.score !== undefined ? Math.round(Number(bp.score) * 100) : 0,
          seo: seoCategory?.score !== undefined ? Math.round(Number(seoCategory.score) * 100) : 0,
        }
      }
    }

    return null
  } catch {
    return null
  }
}
