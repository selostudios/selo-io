'use server'

import { createServiceClient } from '@/lib/supabase/server'
import type { SiteAuditCheck, SiteAuditPage, SiteAudit } from '@/lib/audit/types'
import type { ReportPresentationData } from '@/lib/reports/types'
import { transformToPresentation } from '@/app/(authenticated)/seo/reports/[id]/transform'
import type { PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOCheck } from '@/lib/aio/types'

export interface SharedSiteAuditData {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

/**
 * Fetch site audit data for a shared link
 * Uses service client to bypass RLS for public access
 */
export async function getSharedSiteAuditData(auditId: string): Promise<SharedSiteAuditData | null> {
  const supabase = await createServiceClient()

  // Fetch audit
  const { data: audit, error: auditError } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (auditError || !audit) {
    console.error('[Shared Site Audit Error]', {
      type: 'audit_fetch_failed',
      auditId,
      error: auditError?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  // Fetch all checks (paginate to overcome 1000 row limit)
  const allChecks: SiteAuditCheck[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: checksPage, error: checksError } = await supabase
      .from('site_audit_checks')
      .select('*')
      .eq('audit_id', auditId)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (checksError) {
      console.error('[Shared Site Audit Error]', {
        type: 'checks_fetch_failed',
        auditId,
        error: checksError.message,
        timestamp: new Date().toISOString(),
      })
      return null
    }

    if (checksPage && checksPage.length > 0) {
      allChecks.push(...(checksPage as SiteAuditCheck[]))
      offset += pageSize
      hasMore = checksPage.length === pageSize
    } else {
      hasMore = false
    }
  }

  // Fetch all pages (paginate to overcome 1000 row limit)
  const allPages: SiteAuditPage[] = []
  offset = 0
  hasMore = true

  while (hasMore) {
    const { data: pagesPage, error: pagesError } = await supabase
      .from('site_audit_pages')
      .select('*')
      .eq('audit_id', auditId)
      .order('crawled_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (pagesError) {
      console.error('[Shared Site Audit Error]', {
        type: 'pages_fetch_failed',
        auditId,
        error: pagesError.message,
        timestamp: new Date().toISOString(),
      })
      return null
    }

    if (pagesPage && pagesPage.length > 0) {
      allPages.push(...(pagesPage as SiteAuditPage[]))
      offset += pageSize
      hasMore = pagesPage.length === pageSize
    } else {
      hasMore = false
    }
  }

  return {
    audit: audit as SiteAudit,
    checks: allChecks,
    pages: allPages,
  }
}

/**
 * Get full presentation data for a shared report
 * Uses service client to bypass RLS for public access
 */
export async function getSharedReportData(
  reportId: string
): Promise<ReportPresentationData | null> {
  const supabase = await createServiceClient()

  const { data: report, error: reportError } = await supabase
    .from('generated_reports')
    .select(
      `
      *,
      site_audit:site_audits(*),
      performance_audit:performance_audits(*),
      aio_audit:aio_audits(*),
      organization:organizations(name, logo_url, primary_color, secondary_color, accent_color)
    `
    )
    .eq('id', reportId)
    .single()

  if (reportError || !report) {
    console.error('[Shared Report Error]', {
      type: 'report_fetch_failed',
      reportId,
      error: reportError?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const org = report.organization

  const { data: performanceResults } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', report.performance_audit_id)

  const { data: siteChecks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', report.site_audit_id)
    .order('created_at', { ascending: true })

  const { data: aioChecks } = await supabase
    .from('aio_checks')
    .select('*')
    .eq('audit_id', report.aio_audit_id)
    .order('created_at', { ascending: true })

  const reportWithAudits = {
    ...report,
    performance_results: performanceResults ?? [],
    org_name: org?.name ?? null,
    org_logo_url: org?.logo_url ?? null,
    primary_color: org?.primary_color ?? null,
    secondary_color: org?.secondary_color ?? null,
    accent_color: org?.accent_color ?? null,
  }

  const auditData = {
    siteChecks: (siteChecks ?? []) as SiteAuditCheck[],
    performanceResults: (performanceResults ?? []) as PerformanceAuditResult[],
    aioChecks: (aioChecks ?? []) as AIOCheck[],
  }

  return transformToPresentation(reportWithAudits, auditData)
}
