import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'
import type { AuditCheckDefinition, CheckContext, CheckResult } from '../../types'

// Core Web Vitals thresholds (from web.dev)
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 }, // milliseconds
  inp: { good: 200, poor: 500 }, // milliseconds
  cls: { good: 0.1, poor: 0.25 }, // unitless
} as const

type VitalRating = 'good' | 'needs-improvement' | 'poor'

export const coreWebVitals: AuditCheckDefinition = {
  name: 'core_web_vitals',
  category: CheckCategory.Performance,
  priority: CheckPriority.Critical,
  description:
    'Core Web Vitals (LCP, INP, CLS) measure real-world user experience. All three must be good for optimal performance.',
  displayName: 'Poor Core Web Vitals',
  displayNamePassed: 'Good Core Web Vitals',
  learnMoreUrl: 'https://web.dev/articles/vitals',
  isSiteWide: false,
  fixGuidance:
    'LCP: optimize largest image/text block. INP: reduce JavaScript execution time. CLS: set explicit dimensions on images/embeds.',
  feedsScores: [ScoreDimension.Performance],

  async run(context: CheckContext): Promise<CheckResult> {
    const psi = context.psiData as Record<string, unknown> | undefined

    if (!psi) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: 'No PageSpeed Insights data available to evaluate Core Web Vitals.',
        },
      }
    }

    const vitals = extractCoreWebVitals(psi)

    if (vitals === null) {
      return {
        status: CheckStatus.Warning,
        details: {
          message: 'Could not extract Core Web Vitals from PSI data.',
        },
      }
    }

    const { lcp, inp, cls } = vitals

    const lcpRating = rateMetric(lcp, THRESHOLDS.lcp)
    const inpRating = rateMetric(inp, THRESHOLDS.inp)
    const clsRating = rateMetric(cls, THRESHOLDS.cls)

    const ratings = [lcpRating, inpRating, clsRating]

    let status: CheckStatus
    if (ratings.every((r) => r === 'good')) {
      status = CheckStatus.Passed
    } else if (ratings.some((r) => r === 'poor')) {
      status = CheckStatus.Failed
    } else {
      status = CheckStatus.Warning
    }

    const lcpSeconds = (lcp / 1000).toFixed(2)
    const inpMs = Math.round(inp)
    const diagnostics = context.psiDiagnostics ?? []

    let message: string | undefined = undefined
    if (status !== CheckStatus.Passed) {
      const parts = [
        `LCP: ${lcpSeconds}s (${lcpRating}), INP: ${inpMs}ms (${inpRating}), CLS: ${cls.toFixed(3)} (${clsRating})`,
      ]
      if (diagnostics.length > 0) {
        parts.push(
          `Diagnostics: ${diagnostics.map((d) => `${d.title}: ${d.displayValue}`).join(', ')}.`
        )
      }
      message = parts.join('. ')
    }

    return {
      status,
      details: {
        message,
        lcp,
        inp,
        cls,
        lcpRating,
        inpRating,
        clsRating,
        ...(status !== CheckStatus.Passed && diagnostics.length > 0 && { diagnostics }),
      },
    }
  },
}

interface CoreWebVitalsData {
  lcp: number
  inp: number
  cls: number
}

function rateMetric(value: number, thresholds: { good: number; poor: number }): VitalRating {
  if (value <= thresholds.good) return 'good'
  if (value <= thresholds.poor) return 'needs-improvement'
  return 'poor'
}

function extractCoreWebVitals(psi: Record<string, unknown>): CoreWebVitalsData | null {
  try {
    // Try direct properties (pre-normalized)
    if (typeof psi.lcp === 'number' && typeof psi.inp === 'number' && typeof psi.cls === 'number') {
      return { lcp: psi.lcp as number, inp: psi.inp as number, cls: psi.cls as number }
    }

    // Try loadingExperience path (field data from PSI API)
    const loadingExperience = psi.loadingExperience as Record<string, unknown> | undefined
    if (loadingExperience?.metrics) {
      const metrics = loadingExperience.metrics as Record<string, unknown>

      const lcpData = metrics.LARGEST_CONTENTFUL_PAINT_MS as Record<string, unknown> | undefined
      const inpData = metrics.INTERACTION_TO_NEXT_PAINT as Record<string, unknown> | undefined
      const clsData = metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE as Record<string, unknown> | undefined

      if (
        lcpData?.percentile !== undefined &&
        inpData?.percentile !== undefined &&
        clsData?.percentile !== undefined
      ) {
        return {
          lcp: Number(lcpData.percentile),
          inp: Number(inpData.percentile),
          // CLS percentile from PSI is multiplied by 100
          cls: Number(clsData.percentile) / 100,
        }
      }
    }

    // Try lighthouseResult.audits path (lab data)
    const lighthouseResult = psi.lighthouseResult as Record<string, unknown> | undefined
    if (lighthouseResult?.audits) {
      const audits = lighthouseResult.audits as Record<string, unknown>

      const lcpAudit = audits['largest-contentful-paint'] as Record<string, unknown> | undefined
      const inpAudit = audits['interaction-to-next-paint'] as Record<string, unknown> | undefined
      const clsAudit = audits['cumulative-layout-shift'] as Record<string, unknown> | undefined

      // For lab data, INP may not be available — use TBT as proxy is not appropriate here
      if (lcpAudit?.numericValue !== undefined && clsAudit?.numericValue !== undefined) {
        return {
          lcp: Number(lcpAudit.numericValue),
          inp: inpAudit?.numericValue !== undefined ? Number(inpAudit.numericValue) : 0,
          cls: Number(clsAudit.numericValue),
        }
      }
    }

    return null
  } catch {
    return null
  }
}
