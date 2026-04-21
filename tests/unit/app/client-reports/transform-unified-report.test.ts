import { describe, test, expect } from 'vitest'
import { transformToPresentation } from '@/app/(authenticated)/[orgId]/seo/client-reports/[id]/transform'
import type { GeneratedReportWithAudits } from '@/lib/reports/types'
import type { ReportAuditData } from '@/app/(authenticated)/[orgId]/seo/client-reports/actions'
import type { UnifiedAudit } from '@/lib/unified-audit/types'

describe('transformToPresentation — unified audit reports', () => {
  /** Build a minimal report shaped like what `getReportWithAudits` returns for a unified-audit report. */
  function buildReport(
    overrides: Partial<GeneratedReportWithAudits> = {}
  ): GeneratedReportWithAudits {
    const report: GeneratedReportWithAudits = {
      id: 'r1',
      organization_id: null,
      created_by: null,
      audit_id: 'a1',
      site_audit_id: null,
      performance_audit_id: null,
      aio_audit_id: null,
      domain: 'example.com',
      combined_score: 74,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
      view_count: 0,
      executive_summary: null,
      original_executive_summary: null,
      custom_logo_url: null,
      custom_company_name: null,
      org_name: null,
      org_logo_url: null,
      primary_color: null,
      secondary_color: null,
      accent_color: null,
      ...overrides,
    }
    return report
  }

  const emptyAuditData: ReportAuditData = {
    siteChecks: [],
    performanceResults: [],
    aioChecks: [],
  }

  test('returns fully-shaped presentation data when audit is null (legacy joins missing)', () => {
    const result = transformToPresentation({
      report: buildReport(),
      audit: null,
      auditData: emptyAuditData,
    })

    // Top-level shape — this is what the UI renders, so it must exist.
    expect(result).toBeDefined()
    expect(result.id).toBe('r1')
    expect(result.domain).toBe('example.com')

    // Scores default to 0 and stay numeric when audit is null.
    expect(typeof result.scores.seo.score).toBe('number')
    expect(result.scores.seo.score).toBe(0)
    expect(typeof result.scores.page_speed.score).toBe('number')
    expect(result.scores.page_speed.score).toBe(0)
    expect(typeof result.scores.aio.score).toBe('number')
    expect(result.scores.aio.score).toBe(0)

    // Stats must include a numeric pages_analyzed (was the null-deref crash site).
    expect(typeof result.stats.pages_analyzed).toBe('number')
    expect(result.stats.pages_analyzed).toBe(0)

    // Array fields are always arrays (never undefined) so the UI can .map() safely.
    expect(Array.isArray(result.opportunities)).toBe(true)
    expect(Array.isArray(result.projections)).toBe(true)
    expect(Array.isArray(result.recommendations)).toBe(true)
  })

  test('uses scores from the unified audit row, not the legacy joins', () => {
    const audit: Pick<
      UnifiedAudit,
      'seo_score' | 'performance_score' | 'ai_readiness_score' | 'pages_crawled'
    > = {
      seo_score: 72,
      performance_score: 65,
      ai_readiness_score: 81,
      pages_crawled: 23,
    }

    const result = transformToPresentation({
      // Legacy joins are null (the bug scenario) — scores must come from `audit`.
      report: buildReport(),
      audit,
      auditData: emptyAuditData,
    })

    expect(result.scores.seo.score).toBe(72)
    expect(result.scores.page_speed.score).toBe(65)
    expect(result.scores.aio.score).toBe(81)
    expect(result.stats.pages_analyzed).toBe(23)
  })
})
