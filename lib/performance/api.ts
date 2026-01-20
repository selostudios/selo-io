import type {
  PageSpeedResult,
  CWVRating,
  DeviceType,
  Opportunity,
  Diagnostic,
} from './types'

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

export function extractMetrics(result: PageSpeedResult) {
  const lighthouse = result.lighthouseResult
  const fieldData = result.loadingExperience?.metrics

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

    // Core Web Vitals from field data (CrUX)
    lcp_ms: fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    lcp_rating: mapCategoryToRating(fieldData?.LARGEST_CONTENTFUL_PAINT_MS?.category),
    inp_ms: fieldData?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    inp_rating: mapCategoryToRating(fieldData?.INTERACTION_TO_NEXT_PAINT?.category),
    cls_score: fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
      ? fieldData.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
      : null,
    cls_rating: mapCategoryToRating(fieldData?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category),
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
      return typeof auditObj['displayValue'] === 'string' && (auditObj['displayValue'] as string).length > 0
    })
    .map((audit) => ({
      id: audit['id'] as string,
      title: audit['title'] as string,
      description: audit['description'] as string,
      displayValue: audit['displayValue'] as string,
      details: audit['details'] as Diagnostic['details'],
    }))
}
