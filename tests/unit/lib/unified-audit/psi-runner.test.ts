import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runPSIAnalysis } from '@/lib/unified-audit/psi-runner'
import type { AuditPage } from '@/lib/unified-audit/types'

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({ error: null })),
          })),
        })),
      })),
      insert: vi.fn(() => ({ error: null })),
    })),
  })),
}))

vi.mock('@/lib/performance/api', () => ({
  fetchPageSpeedInsights: vi.fn(),
  extractOpportunities: vi.fn(() => []),
  extractDiagnostics: vi.fn(() => []),
}))

vi.mock('@/lib/aio/importance', () => ({
  selectTopPages: vi.fn(),
}))

import { fetchPageSpeedInsights } from '@/lib/performance/api'
import { selectTopPages } from '@/lib/aio/importance'

const mockFetchPSI = vi.mocked(fetchPageSpeedInsights)
const mockSelectTopPages = vi.mocked(selectTopPages)

function makePage(url: string, overrides?: Partial<AuditPage>): AuditPage {
  return {
    id: crypto.randomUUID(),
    audit_id: 'audit-1',
    url,
    title: 'Test Page',
    meta_description: null,
    status_code: 200,
    last_modified: null,
    is_resource: false,
    resource_type: null,
    depth: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('runPSIAnalysis', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns zero counts when PAGESPEED_API_KEY is not set', async () => {
    delete process.env.PAGESPEED_API_KEY

    const result = await runPSIAnalysis(
      'audit-1',
      'https://example.com',
      [makePage('https://example.com')],
      5
    )

    expect(result).toEqual({ pagesAnalyzed: 0, checksUpserted: 0 })
    expect(mockFetchPSI).not.toHaveBeenCalled()
  })

  it('returns zero counts when no HTML pages exist', async () => {
    process.env.PAGESPEED_API_KEY = 'test-key'

    const pages = [makePage('https://example.com/file.pdf', { is_resource: true })]
    const result = await runPSIAnalysis('audit-1', 'https://example.com', pages, 5)

    expect(result).toEqual({ pagesAnalyzed: 0, checksUpserted: 0 })
  })

  it('fetches PSI for selected pages and returns counts', async () => {
    process.env.PAGESPEED_API_KEY = 'test-key'

    const pages = [makePage('https://example.com'), makePage('https://example.com/about')]

    mockSelectTopPages.mockReturnValue([
      { url: 'https://example.com', importanceScore: 100, reasons: ['Homepage'] },
    ])

    // Return a minimal PSI response with lighthouse data
    mockFetchPSI.mockResolvedValue({
      lighthouseResult: {
        categories: {
          performance: { score: 0.9 },
          accessibility: { score: 0.85 },
          'best-practices': { score: 0.92 },
          seo: { score: 0.95 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 2000 },
          'cumulative-layout-shift': { numericValue: 0.05 },
          'interaction-to-next-paint': { numericValue: 150 },
        },
      },
      loadingExperience: { metrics: {} },
    } as never)

    const result = await runPSIAnalysis('audit-1', 'https://example.com', pages, 5)

    expect(result.pagesAnalyzed).toBe(1)
    expect(result.checksUpserted).toBe(3) // lighthouse, cwv, response time
    expect(mockFetchPSI).toHaveBeenCalledWith({ url: 'https://example.com', device: 'mobile' })
  })

  it('continues processing when one page fails', async () => {
    process.env.PAGESPEED_API_KEY = 'test-key'

    const pages = [makePage('https://example.com'), makePage('https://example.com/about')]

    mockSelectTopPages.mockReturnValue([
      { url: 'https://example.com', importanceScore: 100, reasons: ['Homepage'] },
      { url: 'https://example.com/about', importanceScore: 80, reasons: ['Top-level page'] },
    ])

    // First page fails, second succeeds
    mockFetchPSI.mockRejectedValueOnce(new Error('API timeout')).mockResolvedValueOnce({
      lighthouseResult: {
        categories: {
          performance: { score: 0.85 },
          accessibility: { score: 0.9 },
          'best-practices': { score: 0.88 },
          seo: { score: 0.92 },
        },
        audits: {
          'largest-contentful-paint': { numericValue: 2500 },
          'cumulative-layout-shift': { numericValue: 0.08 },
          'interaction-to-next-paint': { numericValue: 180 },
        },
      },
      loadingExperience: { metrics: {} },
    } as never)

    const result = await runPSIAnalysis('audit-1', 'https://example.com', pages, 5)

    expect(result.pagesAnalyzed).toBe(1) // Only second page succeeded
    expect(mockFetchPSI).toHaveBeenCalledTimes(2)
  })

  it('filters out error pages (status >= 400)', async () => {
    process.env.PAGESPEED_API_KEY = 'test-key'

    const pages = [
      makePage('https://example.com', { status_code: 404 }),
      makePage('https://example.com/about', { status_code: 500 }),
    ]

    const result = await runPSIAnalysis('audit-1', 'https://example.com', pages, 5)

    expect(result).toEqual({ pagesAnalyzed: 0, checksUpserted: 0 })
    expect(mockSelectTopPages).not.toHaveBeenCalled()
  })
})
