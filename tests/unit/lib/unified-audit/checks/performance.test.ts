import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckStatus } from '@/lib/enums'
import type { CheckContext } from '@/lib/unified-audit/types'
import { pageResponseTime } from '@/lib/unified-audit/checks/performance/page-response-time'
import { lighthouseScores } from '@/lib/unified-audit/checks/performance/lighthouse-scores'
import { coreWebVitals } from '@/lib/unified-audit/checks/performance/core-web-vitals'
import { mobileFriendly } from '@/lib/unified-audit/checks/performance/mobile-friendly'
import { performanceChecks } from '@/lib/unified-audit/checks/performance'

function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    url: 'https://example.com',
    html: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><h1>Test</h1></body></html>',
    ...overrides,
  }
}

// ─── Index ──────────────────────────────────────────────────────────────────

describe('performanceChecks index', () => {
  it('exports all 4 checks', () => {
    expect(performanceChecks).toHaveLength(4)
    const names = performanceChecks.map((c) => c.name)
    expect(names).toContain('page_response_time')
    expect(names).toContain('lighthouse_scores')
    expect(names).toContain('core_web_vitals')
    expect(names).toContain('mobile_friendly')
  })
})

// ─── Page Response Time ─────────────────────────────────────────────────────

describe('pageResponseTime', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes when PSI LCP is under 3s (loadingExperience path)', async () => {
    const context = makeContext({
      psiData: {
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1800 },
          },
        },
      },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.lcp_ms).toBe(1800)
    expect(result.details?.source).toBe('psi')
  })

  it('warns when PSI LCP is between 3s and 5s', async () => {
    const context = makeContext({
      psiData: {
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 4200 },
          },
        },
      },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.lcp_ms).toBe(4200)
  })

  it('fails when PSI LCP exceeds 5s', async () => {
    const context = makeContext({
      psiData: {
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 6500 },
          },
        },
      },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.lcp_ms).toBe(6500)
  })

  it('reads LCP from lighthouseResult.audits path', async () => {
    const context = makeContext({
      psiData: {
        lighthouseResult: {
          audits: {
            'largest-contentful-paint': { numericValue: 2100 },
          },
        },
      },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.lcp_ms).toBe(2100)
  })

  it('reads LCP from direct lcp property (pre-normalized)', async () => {
    const context = makeContext({
      psiData: { lcp: 3500 },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.lcp_ms).toBe(3500)
  })

  it('falls back to fetch when no PSI data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('OK', { status: 200 })))

    const context = makeContext({ psiData: undefined })
    const result = await pageResponseTime.run(context)
    // Should have used fetch fallback
    expect(result.details?.source).toBe('fetch')
    expect(result.details?.response_time_ms).toBeDefined()
  })

  it('fails on fetch timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')))

    const context = makeContext({ psiData: undefined })
    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.message).toContain('timed out')
  })

  it('passes at exactly 3000ms boundary', async () => {
    const context = makeContext({
      psiData: { lcp: 3000 },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns at exactly 5000ms boundary', async () => {
    const context = makeContext({
      psiData: { lcp: 5000 },
    })

    const result = await pageResponseTime.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
  })
})

// ─── Lighthouse Scores ──────────────────────────────────────────────────────

describe('lighthouseScores', () => {
  it('passes when performance score is 90+', async () => {
    const context = makeContext({
      psiData: { performance: 95, accessibility: 88, bestPractices: 92, seo: 100 },
    })

    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.performance).toBe(95)
    expect(result.details?.accessibility).toBe(88)
    expect(result.details?.bestPractices).toBe(92)
    expect(result.details?.seo).toBe(100)
  })

  it('warns when performance score is between 50-89', async () => {
    const context = makeContext({
      psiData: { performance: 72, accessibility: 95, bestPractices: 80, seo: 90 },
    })

    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.performance).toBe(72)
  })

  it('fails when performance score is below 50', async () => {
    const context = makeContext({
      psiData: { performance: 35, accessibility: 60, bestPractices: 45, seo: 70 },
    })

    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
  })

  it('extracts scores from lighthouseResult.categories (raw PSI format with 0-1 fractions)', async () => {
    const context = makeContext({
      psiData: {
        lighthouseResult: {
          categories: {
            performance: { score: 0.92 },
            accessibility: { score: 0.85 },
            'best-practices': { score: 0.78 },
            seo: { score: 0.96 },
          },
        },
      },
    })

    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.performance).toBe(92)
    expect(result.details?.accessibility).toBe(85)
    expect(result.details?.bestPractices).toBe(78)
    expect(result.details?.seo).toBe(96)
  })

  it('warns when no PSI data available', async () => {
    const context = makeContext({ psiData: undefined })
    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message).toContain('No PageSpeed Insights data')
  })

  it('warns when PSI data has no lighthouse scores', async () => {
    const context = makeContext({ psiData: { someOtherData: true } })
    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message).toContain('Could not extract')
  })

  it('passes at exactly 90 boundary', async () => {
    const context = makeContext({
      psiData: { performance: 90, accessibility: 90, bestPractices: 90, seo: 90 },
    })
    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns at exactly 50 boundary', async () => {
    const context = makeContext({
      psiData: { performance: 50, accessibility: 90, bestPractices: 90, seo: 90 },
    })
    const result = await lighthouseScores.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('includes rating labels in details', async () => {
    const context = makeContext({
      psiData: { performance: 95, accessibility: 60, bestPractices: 30, seo: 90 },
    })
    const result = await lighthouseScores.run(context)
    const labels = result.details?.labels as Record<string, string>
    expect(labels.performance).toBe('good')
    expect(labels.accessibility).toBe('needs improvement')
    expect(labels.bestPractices).toBe('poor')
    expect(labels.seo).toBe('good')
  })
})

// ─── Core Web Vitals ────────────────────────────────────────────────────────

describe('coreWebVitals', () => {
  it('passes when all vitals are good (direct properties)', async () => {
    const context = makeContext({
      psiData: { lcp: 1800, inp: 150, cls: 0.05 },
    })

    const result = await coreWebVitals.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.lcpRating).toBe('good')
    expect(result.details?.inpRating).toBe('good')
    expect(result.details?.clsRating).toBe('good')
  })

  it('fails when any vital is poor', async () => {
    const context = makeContext({
      psiData: { lcp: 1800, inp: 150, cls: 0.3 }, // CLS is poor
    })

    const result = await coreWebVitals.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.clsRating).toBe('poor')
  })

  it('warns when vitals need improvement but none are poor', async () => {
    const context = makeContext({
      psiData: { lcp: 3000, inp: 150, cls: 0.05 }, // LCP needs improvement
    })

    const result = await coreWebVitals.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.lcpRating).toBe('needs-improvement')
  })

  it('extracts from loadingExperience path', async () => {
    const context = makeContext({
      psiData: {
        loadingExperience: {
          metrics: {
            LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2000 },
            INTERACTION_TO_NEXT_PAINT: { percentile: 180 },
            CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 8 }, // 8/100 = 0.08
          },
        },
      },
    })

    const result = await coreWebVitals.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.lcp).toBe(2000)
    expect(result.details?.inp).toBe(180)
    expect(result.details?.cls).toBe(0.08)
  })

  it('warns when no PSI data available', async () => {
    const context = makeContext({ psiData: undefined })
    const result = await coreWebVitals.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('warns when PSI data has no CWV metrics', async () => {
    const context = makeContext({ psiData: { someOtherData: true } })
    const result = await coreWebVitals.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
  })

  // Boundary tests
  it('LCP at exactly 2500ms is good', async () => {
    const context = makeContext({ psiData: { lcp: 2500, inp: 100, cls: 0.05 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.lcpRating).toBe('good')
  })

  it('LCP at 2501ms needs improvement', async () => {
    const context = makeContext({ psiData: { lcp: 2501, inp: 100, cls: 0.05 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.lcpRating).toBe('needs-improvement')
  })

  it('LCP at exactly 4000ms needs improvement', async () => {
    const context = makeContext({ psiData: { lcp: 4000, inp: 100, cls: 0.05 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.lcpRating).toBe('needs-improvement')
  })

  it('LCP at 4001ms is poor', async () => {
    const context = makeContext({ psiData: { lcp: 4001, inp: 100, cls: 0.05 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.lcpRating).toBe('poor')
  })

  it('INP at exactly 200ms is good', async () => {
    const context = makeContext({ psiData: { lcp: 1000, inp: 200, cls: 0.05 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.inpRating).toBe('good')
  })

  it('INP at exactly 500ms needs improvement', async () => {
    const context = makeContext({ psiData: { lcp: 1000, inp: 500, cls: 0.05 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.inpRating).toBe('needs-improvement')
  })

  it('CLS at exactly 0.1 is good', async () => {
    const context = makeContext({ psiData: { lcp: 1000, inp: 100, cls: 0.1 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.clsRating).toBe('good')
  })

  it('CLS at exactly 0.25 needs improvement', async () => {
    const context = makeContext({ psiData: { lcp: 1000, inp: 100, cls: 0.25 } })
    const result = await coreWebVitals.run(context)
    expect(result.details?.clsRating).toBe('needs-improvement')
  })
})

// ─── Mobile Friendly ────────────────────────────────────────────────────────

describe('mobileFriendly', () => {
  it('passes with proper viewport meta tag', async () => {
    const context = makeContext({
      html: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns when viewport is missing', async () => {
    const context = makeContext({
      html: '<html><head></head><body></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message).toContain('Missing viewport')
  })

  it('warns when viewport lacks width=device-width', async () => {
    const context = makeContext({
      html: '<html><head><meta name="viewport" content="width=1024"></head><body></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message).toContain('width=device-width')
  })

  it('fails with multiple issues (missing viewport + fixed width)', async () => {
    const context = makeContext({
      html: '<html><head></head><body><div style="width: 1200px">Content</div></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.issues).toHaveLength(2)
  })

  it('detects fixed-width layouts (1000px+)', async () => {
    const context = makeContext({
      html: '<html><head><meta name="viewport" content="width=device-width"></head><body><div style="width: 1400px">Content</div></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message).toContain('fixed-width')
  })

  it('includes media queries in mobile signals when present', async () => {
    const context = makeContext({
      html: '<html><head><meta name="viewport" content="width=device-width"><style>@media (max-width: 768px) { }</style></head><body></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('detects apple-mobile-web-app-capable meta tag', async () => {
    const context = makeContext({
      html: '<html><head><meta name="viewport" content="width=device-width"><meta name="apple-mobile-web-app-capable" content="yes"></head><body></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('does not flag fixed widths under 1000px', async () => {
    const context = makeContext({
      html: '<html><head><meta name="viewport" content="width=device-width"></head><body><div style="width: 900px">Content</div></body></html>',
    })

    const result = await mobileFriendly.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })
})
