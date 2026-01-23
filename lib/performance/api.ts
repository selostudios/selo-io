import type { PageSpeedResult, CWVRating, DeviceType, Opportunity, Diagnostic } from './types'

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

interface FetchPageSpeedOptions {
  url: string
  device: DeviceType
}

export async function fetchPageSpeedInsights({
  url,
  device,
}: FetchPageSpeedOptions): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY
  if (!apiKey) {
    throw new Error('PAGESPEED_API_KEY environment variable is not set')
  }

  // URLSearchParams doesn't handle multiple same-name params well, so build URL manually
  const categoryParams = ['performance', 'accessibility', 'best-practices', 'seo']
    .map((c) => `category=${c}`)
    .join('&')

  const fullUrl = `${PAGESPEED_API_URL}?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=${device}&${categoryParams}`

  const response = await fetch(fullUrl, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`PageSpeed API error (${response.status}): ${errorText}`)
  }

  return response.json()
}

export function mapCategoryToRating(category: string | undefined): CWVRating | null {
  if (!category) return null
  const mapping: Record<string, CWVRating> = {
    FAST: 'good',
    AVERAGE: 'needs_improvement',
    SLOW: 'poor',
  }
  return mapping[category] || null
}

/**
 * Calculate LCP rating based on thresholds
 * Good: <= 2500ms, Needs Improvement: <= 4000ms, Poor: > 4000ms
 */
function getLcpRating(lcpMs: number | null): CWVRating | null {
  if (lcpMs === null) return null
  if (lcpMs <= 2500) return 'good'
  if (lcpMs <= 4000) return 'needs_improvement'
  return 'poor'
}

/**
 * Calculate CLS rating based on thresholds
 * Good: <= 0.1, Needs Improvement: <= 0.25, Poor: > 0.25
 */
function getClsRating(clsScore: number | null): CWVRating | null {
  if (clsScore === null) return null
  if (clsScore <= 0.1) return 'good'
  if (clsScore <= 0.25) return 'needs_improvement'
  return 'poor'
}

/**
 * Calculate INP rating based on thresholds
 * Good: <= 200ms, Needs Improvement: <= 500ms, Poor: > 500ms
 */
function getInpRating(inpMs: number | null): CWVRating | null {
  if (inpMs === null) return null
  if (inpMs <= 200) return 'good'
  if (inpMs <= 500) return 'needs_improvement'
  return 'poor'
}

export function extractMetrics(result: PageSpeedResult) {
  const lighthouse = result.lighthouseResult
  const audits = lighthouse.audits
  const fieldData = result.loadingExperience?.metrics

  // Extract lab data from Lighthouse audits as fallback
  const lcpAudit = audits['largest-contentful-paint'] as { numericValue?: number } | undefined
  const clsAudit = audits['cumulative-layout-shift'] as { numericValue?: number } | undefined
  // Note: INP has no lab equivalent - it's field-only. TBT is the closest proxy but measures different things.
  // We could use experimental-interaction-to-next-paint if available in newer Lighthouse versions.
  const inpAudit = audits['experimental-interaction-to-next-paint'] as
    | { numericValue?: number }
    | undefined

  // Use field data (CrUX) if available, otherwise fall back to lab data
  const lcp_ms = fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? lcpAudit?.numericValue ?? null
  const cls_raw = fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? null
  const cls_lab = clsAudit?.numericValue ?? null
  // CLS from CrUX is multiplied by 100 (e.g., 10 = 0.10), lab data is already decimal
  const cls_score = cls_raw !== null ? cls_raw / 100 : cls_lab
  const inp_ms = fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile ?? inpAudit?.numericValue ?? null

  // Use field ratings if available, otherwise calculate from values
  const lcp_rating =
    mapCategoryToRating(fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.category) ?? getLcpRating(lcp_ms)
  const cls_rating =
    mapCategoryToRating(fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category) ?? getClsRating(cls_score)
  const inp_rating =
    mapCategoryToRating(fieldData?.INTERACTION_TO_NEXT_PAINT?.category) ?? getInpRating(inp_ms)

  return {
    // Lighthouse scores (convert 0-1 to 0-100)
    performance_score: lighthouse.categories.performance?.score
      ? Math.round(lighthouse.categories.performance.score * 100)
      : null,
    accessibility_score: lighthouse.categories.accessibility?.score
      ? Math.round(lighthouse.categories.accessibility.score * 100)
      : null,
    best_practices_score: lighthouse.categories['best-practices']?.score
      ? Math.round(lighthouse.categories['best-practices'].score * 100)
      : null,
    seo_score: lighthouse.categories.seo?.score
      ? Math.round(lighthouse.categories.seo.score * 100)
      : null,

    // Core Web Vitals - field data (CrUX) with lab data fallback
    lcp_ms: lcp_ms !== null ? Math.round(lcp_ms) : null,
    lcp_rating,
    inp_ms: inp_ms !== null ? Math.round(inp_ms) : null,
    inp_rating,
    cls_score: cls_score !== null ? Math.round(cls_score * 1000) / 1000 : null, // Round to 3 decimals
    cls_rating,
  }
}

export function extractOpportunities(result: PageSpeedResult): Opportunity[] {
  const audits = result.lighthouseResult.audits

  return Object.values(audits)
    .filter((audit): audit is Record<string, unknown> => {
      if (typeof audit !== 'object' || audit === null) return false
      const auditObj = audit as Record<string, unknown>
      const score = auditObj['score'] as number | null
      const numericValue = auditObj['numericValue'] as number | undefined
      return score !== null && score < 1 && typeof numericValue === 'number' && numericValue > 0
    })
    .sort((a, b) => (b['numericValue'] as number) - (a['numericValue'] as number))
    .map((audit) => ({
      id: audit['id'] as string,
      title: audit['title'] as string,
      description: audit['description'] as string,
      score: audit['score'] as number,
      numericValue: audit['numericValue'] as number,
      displayValue: (audit['displayValue'] as string) ?? '',
      details: audit['details'] as Opportunity['details'],
    }))
}

const DIAGNOSTIC_IDS = [
  'dom-size',
  'total-byte-weight',
  'mainthread-work-breakdown',
  'bootup-time',
  'network-requests',
  'largest-contentful-paint-element',
  'layout-shift-elements',
  'long-tasks',
]

export function extractDiagnostics(result: PageSpeedResult): Diagnostic[] {
  const audits = result.lighthouseResult.audits

  return DIAGNOSTIC_IDS.map((id) => audits[id])
    .filter((audit): audit is Record<string, unknown> => {
      if (typeof audit !== 'object' || audit === null) return false
      const auditObj = audit as Record<string, unknown>
      return (
        typeof auditObj['displayValue'] === 'string' &&
        (auditObj['displayValue'] as string).length > 0
      )
    })
    .map((audit) => ({
      id: audit['id'] as string,
      title: audit['title'] as string,
      description: audit['description'] as string,
      displayValue: audit['displayValue'] as string,
      details: audit['details'] as Diagnostic['details'],
    }))
}
