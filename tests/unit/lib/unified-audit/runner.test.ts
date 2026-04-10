import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckStatus, CheckPriority, CheckCategory, ScoreDimension } from '@/lib/enums'
import type { AuditCheck, AuditPage } from '@/lib/unified-audit/types'

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn() }) })
const mockInsert = vi.fn().mockReturnValue({ error: null })
const mockSelect = vi.fn()
const mockFrom = vi.fn().mockReturnValue({
  update: mockUpdate,
  insert: mockInsert,
  select: mockSelect,
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
  createClient: vi.fn(),
}))

// Mock fetcher
vi.mock('@/lib/audit/fetcher', () => ({
  fetchPage: vi.fn().mockResolvedValue({
    html: '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>',
    statusCode: 200,
    lastModified: null,
    finalUrl: 'https://example.com',
  }),
}))

// Mock crawler
vi.mock('@/lib/audit/crawler', () => ({
  crawlSite: vi.fn(),
}))

vi.mock('@/lib/audit/batch-crawler', () => ({
  initializeCrawlQueue: vi.fn(),
  crawlBatch: vi.fn(),
}))

// Import after mocks
import { buildCheckRecord, completeAuditScoring } from '@/lib/unified-audit/runner'
import { siteWideChecks, pageSpecificChecks, allChecks } from '@/lib/unified-audit/checks'

describe('buildCheckRecord', () => {
  it('creates a properly structured check record for a page-specific check', () => {
    const check = pageSpecificChecks[0]
    const result = { status: CheckStatus.Passed, details: { message: 'All good' } }

    const record = buildCheckRecord('audit-1', 'https://example.com/page', check, result)

    expect(record.audit_id).toBe('audit-1')
    expect(record.page_url).toBe('https://example.com/page')
    expect(record.check_name).toBe(check.name)
    expect(record.category).toBe(check.category)
    expect(record.priority).toBe(check.priority)
    expect(record.status).toBe(CheckStatus.Passed)
    expect(record.feeds_scores).toEqual(check.feedsScores)
    expect(record.id).toBeTruthy()
    expect(record.created_at).toBeTruthy()
  })

  it('creates a site-wide check record with null page_url', () => {
    const check = siteWideChecks[0]
    const result = { status: CheckStatus.Failed, details: { message: 'Missing' } }

    const record = buildCheckRecord('audit-1', null, check, result)

    expect(record.page_url).toBeNull()
    expect(record.status).toBe(CheckStatus.Failed)
    expect(record.display_name).toBe(check.displayName)
    expect(record.description).toBe(check.description)
  })

  it('uses check fixGuidance when result has no message', () => {
    const check = { ...pageSpecificChecks[0], fixGuidance: 'Add a title tag' }
    const result = { status: CheckStatus.Failed }

    const record = buildCheckRecord('audit-1', 'https://example.com/page', check, result)

    expect(record.fix_guidance).toBe('Add a title tag')
  })
})

describe('completeAuditScoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock chain for update
    const eqInner = vi.fn().mockReturnValue({ select: vi.fn() })
    const eqOuter = vi.fn().mockReturnValue(eqInner)
    mockUpdate.mockReturnValue({ eq: eqOuter })
    mockFrom.mockReturnValue({
      update: mockUpdate,
      insert: mockInsert,
      select: mockSelect,
    })
  })

  it('calculates correct scores from check results and updates the audit', async () => {
    const checks: AuditCheck[] = [
      // 2 SEO checks: 1 passed (critical), 1 failed (recommended)
      {
        id: '1',
        audit_id: 'a1',
        page_url: 'https://example.com',
        category: CheckCategory.MetaContent,
        check_name: 'missing-title',
        priority: CheckPriority.Critical,
        status: CheckStatus.Passed,
        display_name: 'Missing Title',
        display_name_passed: 'Title Present',
        description: 'Check for title tag',
        fix_guidance: null,
        learn_more_url: null,
        details: null,
        feeds_scores: [ScoreDimension.SEO],
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        audit_id: 'a1',
        page_url: 'https://example.com',
        category: CheckCategory.MetaContent,
        check_name: 'title-length',
        priority: CheckPriority.Recommended,
        status: CheckStatus.Failed,
        display_name: 'Title Length',
        display_name_passed: 'Title Length OK',
        description: 'Check title length',
        fix_guidance: null,
        learn_more_url: null,
        details: null,
        feeds_scores: [ScoreDimension.SEO],
        created_at: new Date().toISOString(),
      },
      // 1 AI check: warning (critical)
      {
        id: '3',
        audit_id: 'a1',
        page_url: null,
        category: CheckCategory.AIVisibility,
        check_name: 'missing-llms-txt',
        priority: CheckPriority.Critical,
        status: CheckStatus.Warning,
        display_name: 'Missing llms.txt',
        display_name_passed: 'llms.txt Present',
        description: 'Check for llms.txt',
        fix_guidance: null,
        learn_more_url: null,
        details: null,
        feeds_scores: [ScoreDimension.AIReadiness],
        created_at: new Date().toISOString(),
      },
      // 1 Performance check: passed (critical)
      {
        id: '4',
        audit_id: 'a1',
        page_url: 'https://example.com',
        category: CheckCategory.Security,
        check_name: 'missing-ssl',
        priority: CheckPriority.Critical,
        status: CheckStatus.Passed,
        display_name: 'Missing SSL',
        display_name_passed: 'SSL Present',
        description: 'Check for SSL',
        fix_guidance: null,
        learn_more_url: null,
        details: null,
        feeds_scores: [ScoreDimension.Performance],
        created_at: new Date().toISOString(),
      },
    ]

    const pages: AuditPage[] = [
      {
        id: 'p1',
        audit_id: 'a1',
        url: 'https://example.com',
        title: 'Example',
        meta_description: null,
        status_code: 200,
        last_modified: null,
        is_resource: false,
        resource_type: null,
        depth: 0,
        created_at: new Date().toISOString(),
      },
    ]

    await completeAuditScoring('a1', 'https://example.com', pages, checks, 5, true, null)

    // Verify update was called
    expect(mockFrom).toHaveBeenCalledWith('audits')
    expect(mockUpdate).toHaveBeenCalled()

    // The first update sets status to 'analyzing', the second is the final scoring update
    const finalUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][0]

    // SEO: critical(3) passed + recommended(2) failed = 300/(500) = 60%
    expect(finalUpdateCall.seo_score).toBe(60)

    // AI Readiness: critical(3) warning = 150/300 = 50% (no strategic, 100% programmatic)
    expect(finalUpdateCall.ai_readiness_score).toBe(50)

    // Performance: critical(3) passed = 300/300 = 100%
    expect(finalUpdateCall.performance_score).toBe(100)

    // Overall: 60*0.4 + 100*0.3 + 50*0.3 = 24 + 30 + 15 = 69
    expect(finalUpdateCall.overall_score).toBe(69)

    // Counts
    expect(finalUpdateCall.failed_count).toBe(1)
    expect(finalUpdateCall.warning_count).toBe(1)
    expect(finalUpdateCall.passed_count).toBe(2)

    expect(finalUpdateCall.status).toBe('completed')
  })

  it('returns 0 for dimensions with no matching checks', async () => {
    // Only SEO check — performance and AI will have 0 checks → score 0
    const checks: AuditCheck[] = [
      {
        id: '1',
        audit_id: 'a1',
        page_url: 'https://example.com',
        category: CheckCategory.MetaContent,
        check_name: 'test',
        priority: CheckPriority.Critical,
        status: CheckStatus.Passed,
        display_name: 'Test',
        display_name_passed: 'Test Passed',
        description: 'Test check',
        fix_guidance: null,
        learn_more_url: null,
        details: null,
        feeds_scores: [ScoreDimension.SEO],
        created_at: new Date().toISOString(),
      },
    ]

    const pages: AuditPage[] = [
      {
        id: 'p1',
        audit_id: 'a1',
        url: 'https://example.com',
        title: 'Example',
        meta_description: null,
        status_code: 200,
        last_modified: null,
        is_resource: false,
        resource_type: null,
        depth: 0,
        created_at: new Date().toISOString(),
      },
    ]

    await completeAuditScoring('a1', 'https://example.com', pages, checks, 5, true, null)

    // The first update sets status to 'analyzing', the second is the final scoring update
    const finalUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1][0]
    expect(finalUpdateCall.seo_score).toBe(100)
    // No performance or AI checks → calculateCheckScore returns 0
    expect(finalUpdateCall.ai_readiness_score).toBe(0)
    expect(finalUpdateCall.performance_score).toBe(0)
    // Overall with partial weighting: all 3 modules complete with scores 100, 0, 0
    // = (100*0.4 + 0*0.3 + 0*0.3) / (0.4+0.3+0.3) = 40/1.0 = 40
    expect(finalUpdateCall.overall_score).toBe(40)
  })
})

describe('check collections', () => {
  it('site-wide checks are a subset of all checks and are marked isSiteWide', () => {
    for (const check of siteWideChecks) {
      expect(check.isSiteWide).toBe(true)
    }
    expect(siteWideChecks.length).toBeGreaterThan(0)
  })

  it('page-specific checks are not site-wide', () => {
    for (const check of pageSpecificChecks) {
      expect(check.isSiteWide).toBeFalsy()
    }
    expect(pageSpecificChecks.length).toBeGreaterThan(0)
  })

  it('site-wide + page-specific = all checks', () => {
    const combinedNames = [...siteWideChecks, ...pageSpecificChecks].map((c) => c.name).sort()
    const expectedNames = allChecks.map((c) => c.name).sort()
    expect(combinedNames).toEqual(expectedNames)
  })
})
