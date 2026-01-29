'use server'

import { createServiceClient } from '@/lib/supabase/server'
import type { SiteAudit, SiteAuditCheck } from '@/lib/audit/types'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit, AIOCheck } from '@/lib/aio/types'
import type { GeneratedReport, ReportPresentationData } from '@/lib/reports/types'
import { transformToPresentation } from '@/app/(authenticated)/seo/reports/[id]/transform'

/**
 * Get full presentation data for a shared report
 * Uses service client to bypass RLS for public access
 */
export async function getSharedReportPresentationData(
  reportId: string
): Promise<ReportPresentationData | null> {
  const supabase = await createServiceClient()

  // Fetch report with audits using service role (bypasses RLS)
  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select(
      `
      *,
      site_audit:site_audits(*),
      performance_audit:performance_audits(*),
      aio_audit:aio_audits(*)
    `
    )
    .eq('id', reportId)
    .single()

  if (reportError || !report) {
    console.error('[Shared Report Error]', {
      type: 'report_fetch_failed',
      reportId,
      error: reportError?.message,
    })
    return null
  }

  // Fetch performance results
  const { data: performanceResults } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', report.performance_audit_id)

  // Fetch site audit checks
  const { data: siteChecks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', report.site_audit_id)
    .order('created_at', { ascending: true })

  // Fetch AIO checks
  const { data: aioChecks } = await supabase
    .from('aio_checks')
    .select('*')
    .eq('audit_id', report.aio_audit_id)
    .order('created_at', { ascending: true })

  // Transform to presentation data
  const reportWithAudits = {
    ...report,
    performance_results: performanceResults ?? [],
  }

  const auditData = {
    siteChecks: (siteChecks ?? []) as SiteAuditCheck[],
    performanceResults: (performanceResults ?? []) as PerformanceAuditResult[],
    aioChecks: (aioChecks ?? []) as AIOCheck[],
  }

  return transformToPresentation(reportWithAudits, auditData)
}
