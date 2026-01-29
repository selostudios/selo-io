import { describe, it, expect } from 'vitest'
import {
  extractDomain,
  validateSiteAudit,
  validatePerformanceAudit,
  validateAIOAudit,
  validateReportAudits,
  getMissingAudits,
  formatMissingAudits,
} from '@/lib/reports/validation'
import { AuditStatus, PerformanceAuditStatus, AIOAuditStatus, AuditSource } from '@/lib/enums'
import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit } from '@/lib/aio/types'

// ============================================================
// DOMAIN EXTRACTION TESTS
// ============================================================

describe('extractDomain', () => {
  it('extracts domain from full URL with https', () => {
    expect(extractDomain('https://example.com/page')).toBe('example.com')
  })

  it('extracts domain from full URL with http', () => {
    expect(extractDomain('http://example.com/page')).toBe('example.com')
  })

  it('removes www prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com')
  })

  it('handles URL without protocol', () => {
    expect(extractDomain('example.com/page')).toBe('example.com')
  })

  it('converts to lowercase', () => {
    expect(extractDomain('https://EXAMPLE.COM')).toBe('example.com')
  })

  it('handles subdomains', () => {
    expect(extractDomain('https://blog.example.com')).toBe('blog.example.com')
  })

  it('handles ports', () => {
    expect(extractDomain('https://example.com:8080/page')).toBe('example.com')
  })

  it('handles query strings', () => {
    expect(extractDomain('https://example.com?foo=bar')).toBe('example.com')
  })
})

// ============================================================
// SITE AUDIT VALIDATION TESTS
// ============================================================

describe('validateSiteAudit', () => {
  function createSiteAudit(overrides: Partial<SiteAudit> = {}): SiteAudit {
    return {
      id: 'audit-1',
      organization_id: 'org-1',
      url: 'https://example.com',
      status: AuditStatus.Completed,
      pages_found: 10,
      pages_crawled: 10,
      overall_score: 85,
      seo_score: 90,
      ai_readiness_score: 80,
      technical_score: 85,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    }
  }

  it('returns eligible for valid completed audit', () => {
    const audit = createSiteAudit()
    const result = validateSiteAudit(audit)

    expect(result.is_eligible).toBe(true)
    expect(result.audit_id).toBe('audit-1')
    expect(result.score).toBe(85)
    expect(result.domain).toBe('example.com')
    expect(result.audit_type).toBe(AuditSource.SEO)
  })

  it('returns ineligible when audit is null', () => {
    const result = validateSiteAudit(null)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toBe('No SEO audit found')
  })

  it('returns ineligible for pending audit', () => {
    const audit = createSiteAudit({ status: AuditStatus.Pending })
    const result = validateSiteAudit(audit)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toContain('not completed')
  })

  it('returns ineligible for running audit', () => {
    const audit = createSiteAudit({ status: AuditStatus.Running })
    const result = validateSiteAudit(audit)

    expect(result.is_eligible).toBe(false)
  })

  it('returns ineligible when score is null', () => {
    const audit = createSiteAudit({ overall_score: null })
    const result = validateSiteAudit(audit)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toBe('SEO audit has no score')
  })
})

// ============================================================
// PERFORMANCE AUDIT VALIDATION TESTS
// ============================================================

describe('validatePerformanceAudit', () => {
  function createPerformanceAudit(overrides: Partial<PerformanceAudit> = {}): PerformanceAudit {
    return {
      id: 'perf-1',
      organization_id: 'org-1',
      status: PerformanceAuditStatus.Completed,
      total_urls: 1,
      completed_urls: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      first_url: 'https://example.com',
      ...overrides,
    }
  }

  function createPerformanceResult(overrides: Partial<PerformanceAuditResult> = {}): PerformanceAuditResult {
    return {
      id: 'result-1',
      audit_id: 'perf-1',
      url: 'https://example.com',
      device: 'desktop',
      performance_score: 90,
      accessibility_score: 95,
      best_practices_score: 100,
      seo_score: 92,
      created_at: new Date().toISOString(),
      ...overrides,
    }
  }

  it('returns eligible for valid completed audit with scores', () => {
    const audit = createPerformanceAudit()
    const results = [createPerformanceResult()]
    const result = validatePerformanceAudit(audit, results)

    expect(result.is_eligible).toBe(true)
    expect(result.audit_id).toBe('perf-1')
    expect(result.score).toBe(90)
    expect(result.domain).toBe('example.com')
    expect(result.audit_type).toBe(AuditSource.PageSpeed)
  })

  it('calculates average score from multiple results', () => {
    const audit = createPerformanceAudit()
    const results = [
      createPerformanceResult({ performance_score: 80 }),
      createPerformanceResult({ id: 'result-2', performance_score: 100 }),
    ]
    const result = validatePerformanceAudit(audit, results)

    expect(result.score).toBe(90) // (80 + 100) / 2 = 90
  })

  it('returns ineligible when audit is null', () => {
    const result = validatePerformanceAudit(null, [])

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toBe('No PageSpeed audit found')
  })

  it('returns ineligible for pending audit', () => {
    const audit = createPerformanceAudit({ status: PerformanceAuditStatus.Pending })
    const result = validatePerformanceAudit(audit, [])

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toContain('not completed')
  })

  it('returns ineligible when no results have scores', () => {
    const audit = createPerformanceAudit()
    const results = [createPerformanceResult({ performance_score: null })]
    const result = validatePerformanceAudit(audit, results)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toBe('PageSpeed audit has no performance scores')
  })

  it('filters out null scores when averaging', () => {
    const audit = createPerformanceAudit()
    const results = [
      createPerformanceResult({ performance_score: 80 }),
      createPerformanceResult({ id: 'result-2', performance_score: null }),
    ]
    const result = validatePerformanceAudit(audit, results)

    expect(result.score).toBe(80) // Only counts the non-null score
  })
})

// ============================================================
// AIO AUDIT VALIDATION TESTS
// ============================================================

describe('validateAIOAudit', () => {
  function createAIOAudit(overrides: Partial<AIOAudit> = {}): AIOAudit {
    return {
      id: 'aio-1',
      organization_id: 'org-1',
      created_by: 'user-1',
      url: 'https://example.com',
      status: AIOAuditStatus.Completed,
      overall_aio_score: 75,
      content_quality_score: 80,
      content_structure_score: 70,
      technical_foundation_score: 75,
      checks_total: 10,
      checks_passed: 7,
      checks_failed: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    }
  }

  it('returns eligible for valid completed audit', () => {
    const audit = createAIOAudit()
    const result = validateAIOAudit(audit)

    expect(result.is_eligible).toBe(true)
    expect(result.audit_id).toBe('aio-1')
    expect(result.score).toBe(75)
    expect(result.domain).toBe('example.com')
    expect(result.audit_type).toBe(AuditSource.AIO)
  })

  it('returns ineligible when audit is null', () => {
    const result = validateAIOAudit(null)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toBe('No AIO audit found')
  })

  it('returns ineligible for pending audit', () => {
    const audit = createAIOAudit({ status: AIOAuditStatus.Pending })
    const result = validateAIOAudit(audit)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toContain('not completed')
  })

  it('returns ineligible when score is null', () => {
    const audit = createAIOAudit({ overall_aio_score: null })
    const result = validateAIOAudit(audit)

    expect(result.is_eligible).toBe(false)
    expect(result.reason).toBe('AIO audit has no score')
  })
})

// ============================================================
// COMBINED VALIDATION TESTS
// ============================================================

describe('validateReportAudits', () => {
  const baseDate = new Date('2024-01-15T12:00:00Z')

  function createSiteAudit(domain = 'example.com', daysOffset = 0): SiteAudit {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + daysOffset)
    return {
      id: 'audit-1',
      organization_id: 'org-1',
      url: `https://${domain}`,
      status: AuditStatus.Completed,
      pages_found: 10,
      pages_crawled: 10,
      overall_score: 85,
      seo_score: 90,
      ai_readiness_score: 80,
      technical_score: 85,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    }
  }

  function createPerformanceAudit(domain = 'example.com', daysOffset = 0): PerformanceAudit {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + daysOffset)
    return {
      id: 'perf-1',
      organization_id: 'org-1',
      status: PerformanceAuditStatus.Completed,
      total_urls: 1,
      completed_urls: 1,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
      first_url: `https://${domain}`,
    }
  }

  function createPerformanceResults(domain = 'example.com'): PerformanceAuditResult[] {
    return [{
      id: 'result-1',
      audit_id: 'perf-1',
      url: `https://${domain}`,
      device: 'desktop',
      performance_score: 90,
      accessibility_score: 95,
      best_practices_score: 100,
      seo_score: 92,
      created_at: new Date().toISOString(),
    }]
  }

  function createAIOAudit(domain = 'example.com', daysOffset = 0): AIOAudit {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + daysOffset)
    return {
      id: 'aio-1',
      organization_id: 'org-1',
      created_by: 'user-1',
      url: `https://${domain}`,
      status: AIOAuditStatus.Completed,
      overall_aio_score: 75,
      content_quality_score: 80,
      content_structure_score: 70,
      technical_foundation_score: 75,
      checks_total: 10,
      checks_passed: 7,
      checks_failed: 3,
      created_at: date.toISOString(),
      updated_at: date.toISOString(),
    }
  }

  it('returns valid for matching domain audits within 7 days', () => {
    const result = validateReportAudits(
      createSiteAudit(),
      createPerformanceAudit(),
      createPerformanceResults(),
      createAIOAudit()
    )

    expect(result.is_valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns invalid when any audit is null', () => {
    const result = validateReportAudits(
      null,
      createPerformanceAudit(),
      createPerformanceResults(),
      createAIOAudit()
    )

    expect(result.is_valid).toBe(false)
    expect(result.errors).toContain('No SEO audit found')
  })

  it('returns invalid when domains do not match', () => {
    const result = validateReportAudits(
      createSiteAudit('example.com'),
      createPerformanceAudit('different.com'),
      createPerformanceResults('different.com'),
      createAIOAudit('example.com')
    )

    expect(result.is_valid).toBe(false)
    expect(result.errors.some(e => e.includes('same domain'))).toBe(true)
  })

  it('returns invalid when audits are more than 7 days apart', () => {
    const result = validateReportAudits(
      createSiteAudit('example.com', 0),
      createPerformanceAudit('example.com', 10),
      createPerformanceResults(),
      createAIOAudit('example.com', 0)
    )

    expect(result.is_valid).toBe(false)
    expect(result.errors.some(e => e.includes('within 7 days'))).toBe(true)
  })

  it('returns valid with warning when audits are 4-7 days apart', () => {
    const result = validateReportAudits(
      createSiteAudit('example.com', 0),
      createPerformanceAudit('example.com', 5),
      createPerformanceResults(),
      createAIOAudit('example.com', 0)
    )

    expect(result.is_valid).toBe(true)
    expect(result.warnings.some(w => w.includes('days apart'))).toBe(true)
  })

  it('normalizes domains with www prefix', () => {
    // Audits with and without www should match
    const siteAudit = createSiteAudit('www.example.com')
    const perfAudit = createPerformanceAudit('example.com')
    const aioAudit = createAIOAudit('www.example.com')

    const result = validateReportAudits(
      siteAudit,
      perfAudit,
      createPerformanceResults('example.com'),
      aioAudit
    )

    expect(result.is_valid).toBe(true)
  })
})

// ============================================================
// MISSING AUDITS HELPER TESTS
// ============================================================

describe('getMissingAudits', () => {
  it('returns empty array when all audits are eligible', () => {
    const validation = {
      is_valid: true,
      audits: {
        site_audit: { audit_type: AuditSource.SEO, audit_id: '1', score: 85, created_at: '', domain: 'example.com', is_eligible: true },
        performance_audit: { audit_type: AuditSource.PageSpeed, audit_id: '2', score: 90, created_at: '', domain: 'example.com', is_eligible: true },
        aio_audit: { audit_type: AuditSource.AIO, audit_id: '3', score: 75, created_at: '', domain: 'example.com', is_eligible: true },
      },
      errors: [],
      warnings: [],
    }

    const missing = getMissingAudits(validation)
    expect(missing).toHaveLength(0)
  })

  it('returns SEO when site audit is not eligible', () => {
    const validation = {
      is_valid: false,
      audits: {
        site_audit: { audit_type: AuditSource.SEO, audit_id: null, score: null, created_at: null, domain: null, is_eligible: false, reason: 'No SEO audit found' },
        performance_audit: { audit_type: AuditSource.PageSpeed, audit_id: '2', score: 90, created_at: '', domain: 'example.com', is_eligible: true },
        aio_audit: { audit_type: AuditSource.AIO, audit_id: '3', score: 75, created_at: '', domain: 'example.com', is_eligible: true },
      },
      errors: ['No SEO audit found'],
      warnings: [],
    }

    const missing = getMissingAudits(validation)
    expect(missing).toEqual([AuditSource.SEO])
  })

  it('returns all missing audit types', () => {
    const validation = {
      is_valid: false,
      audits: {
        site_audit: { audit_type: AuditSource.SEO, audit_id: null, score: null, created_at: null, domain: null, is_eligible: false },
        performance_audit: { audit_type: AuditSource.PageSpeed, audit_id: null, score: null, created_at: null, domain: null, is_eligible: false },
        aio_audit: { audit_type: AuditSource.AIO, audit_id: null, score: null, created_at: null, domain: null, is_eligible: false },
      },
      errors: [],
      warnings: [],
    }

    const missing = getMissingAudits(validation)
    expect(missing).toContain(AuditSource.SEO)
    expect(missing).toContain(AuditSource.PageSpeed)
    expect(missing).toContain(AuditSource.AIO)
    expect(missing).toHaveLength(3)
  })
})

describe('formatMissingAudits', () => {
  it('returns empty string for no missing audits', () => {
    expect(formatMissingAudits([])).toBe('')
  })

  it('formats single missing audit', () => {
    expect(formatMissingAudits([AuditSource.SEO])).toBe('SEO Audit')
    expect(formatMissingAudits([AuditSource.PageSpeed])).toBe('PageSpeed Audit')
    expect(formatMissingAudits([AuditSource.AIO])).toBe('AIO Audit')
  })

  it('formats two missing audits with "and"', () => {
    expect(formatMissingAudits([AuditSource.SEO, AuditSource.AIO])).toBe('SEO Audit and AIO Audit')
  })

  it('formats three missing audits with commas and "and"', () => {
    expect(formatMissingAudits([AuditSource.SEO, AuditSource.PageSpeed, AuditSource.AIO])).toBe(
      'SEO Audit, PageSpeed Audit, and AIO Audit'
    )
  })
})
