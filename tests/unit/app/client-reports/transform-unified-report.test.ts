import { describe, test, expect } from 'vitest'
import { transformToPresentation } from '@/app/(authenticated)/[orgId]/seo/client-reports/[id]/transform'
import type { GeneratedReportWithAudits } from '@/lib/reports/types'
import type { ReportAuditData } from '@/app/(authenticated)/[orgId]/seo/client-reports/actions'

describe('transformToPresentation — unified audit reports', () => {
  test('produces presentation data when legacy audit joins are missing', () => {
    // Simulates the shape we get for a unified-audit report when
    // site_audit / performance_audit / aio_audit joins return null
    const report = {
      id: 'r1',
      audit_id: 'a1',
      domain: 'example.com',
      combined_score: 74,
      created_at: '2026-04-01T00:00:00Z',
      executive_summary: null,
      custom_logo_url: null,
      custom_company_name: null,
      org_name: null,
      org_logo_url: null,
      primary_color: null,
      secondary_color: null,
      accent_color: null,
      site_audit: null,
      performance_audit: null,
      aio_audit: null,
    } as unknown as GeneratedReportWithAudits

    const auditData: ReportAuditData = {
      siteChecks: [],
      performanceResults: [],
      aioChecks: [],
    }

    expect(() => transformToPresentation(report, auditData)).not.toThrow()
  })
})
