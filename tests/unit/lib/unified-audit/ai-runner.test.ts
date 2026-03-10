import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAIAnalysisPhase } from '@/lib/unified-audit/ai-runner'
import type { AuditPage } from '@/lib/unified-audit/types'

// Mock supabase
const mockInsert = vi.fn(() => ({ error: null }))
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => ({ error: null })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'audit_ai_analyses') {
        return { insert: mockInsert }
      }
      if (table === 'audits') {
        return { update: mockUpdate }
      }
      return {}
    }),
  })),
}))

vi.mock('@/lib/aio/importance', () => ({
  selectTopPages: vi.fn(),
}))

vi.mock('@/lib/aio/ai-auditor', () => ({
  runAIAnalysis: vi.fn(),
  calculateStrategicScore: vi.fn(),
}))

vi.mock('@/lib/audit/fetcher', () => ({
  fetchPage: vi.fn(),
}))

import { selectTopPages } from '@/lib/aio/importance'
import { runAIAnalysis, calculateStrategicScore } from '@/lib/aio/ai-auditor'
import { fetchPage } from '@/lib/audit/fetcher'

const mockSelectTopPages = vi.mocked(selectTopPages)
const mockRunAIAnalysis = vi.mocked(runAIAnalysis)
const mockCalculateStrategicScore = vi.mocked(calculateStrategicScore)
const mockFetchPage = vi.mocked(fetchPage)

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

describe('runAIAnalysisPhase', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns null strategic score when AI analysis is disabled', async () => {
    const result = await runAIAnalysisPhase(
      'audit-1',
      'https://example.com',
      [makePage('https://example.com')],
      5,
      false
    )

    expect(result.strategicScore).toBeNull()
    expect(result.pagesAnalyzed).toBe(0)
    expect(mockRunAIAnalysis).not.toHaveBeenCalled()
  })

  it('returns null strategic score when no HTML pages exist', async () => {
    const result = await runAIAnalysisPhase(
      'audit-1',
      'https://example.com',
      [makePage('https://example.com/doc.pdf', { is_resource: true })],
      5,
      true
    )

    expect(result.strategicScore).toBeNull()
    expect(result.pagesAnalyzed).toBe(0)
  })

  it('runs AI analysis and returns strategic score', async () => {
    const pages = [makePage('https://example.com')]

    mockSelectTopPages.mockReturnValue([
      { url: 'https://example.com', importanceScore: 100, reasons: ['Homepage'] },
    ])

    mockFetchPage.mockResolvedValue({
      html: '<html><body>Content</body></html>',
      statusCode: 200,
      lastModified: null,
    })

    mockRunAIAnalysis.mockResolvedValue({
      analyses: [
        {
          url: 'https://example.com',
          scores: {
            dataQuality: 80,
            expertCredibility: 75,
            comprehensiveness: 70,
            citability: 85,
            authority: 60,
          },
          findings: { strengths: [], weaknesses: [] },
          recommendations: { items: [] },
        } as never,
      ],
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalCost: 0.05,
    })

    mockCalculateStrategicScore.mockReturnValue(74)

    const result = await runAIAnalysisPhase('audit-1', 'https://example.com', pages, 5, true)

    expect(result.strategicScore).toBe(74)
    expect(result.pagesAnalyzed).toBe(1)
    expect(result.totalInputTokens).toBe(1000)
    expect(result.totalOutputTokens).toBe(500)
    expect(result.totalCost).toBe(0.05)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('returns null strategic score when page fetch fails', async () => {
    const pages = [makePage('https://example.com')]

    mockSelectTopPages.mockReturnValue([
      { url: 'https://example.com', importanceScore: 100, reasons: ['Homepage'] },
    ])

    mockFetchPage.mockResolvedValue({
      html: '',
      statusCode: 0,
      lastModified: null,
      error: 'Connection refused',
    })

    const result = await runAIAnalysisPhase('audit-1', 'https://example.com', pages, 5, true)

    expect(result.strategicScore).toBeNull()
    expect(result.pagesAnalyzed).toBe(0)
    expect(mockRunAIAnalysis).not.toHaveBeenCalled()
  })

  it('filters out resource pages and error pages', async () => {
    const pages = [
      makePage('https://example.com/doc.pdf', { is_resource: true }),
      makePage('https://example.com/broken', { status_code: 404 }),
      makePage('https://example.com/server-error', { status_code: 500 }),
    ]

    const result = await runAIAnalysisPhase('audit-1', 'https://example.com', pages, 5, true)

    expect(result.strategicScore).toBeNull()
    expect(mockSelectTopPages).not.toHaveBeenCalled()
  })
})
