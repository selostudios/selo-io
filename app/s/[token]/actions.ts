'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import type { SiteAuditCheck, SiteAuditPage, SiteAudit } from '@/lib/audit/types'
import type { UnifiedAudit, AuditCheck, AuditPage } from '@/lib/unified-audit/types'
import type { ReportPresentationData } from '@/lib/reports/types'
import { transformToPresentation } from '@/app/(authenticated)/seo/reports/[id]/transform'
import type { PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOCheck } from '@/lib/aio/types'

export interface SharedSiteAuditData {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

export interface SharedUnifiedAuditData {
  audit: UnifiedAudit
  checks: AuditCheck[]
  pages: AuditPage[]
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

  try {
    const [checks, pages] = await Promise.all([
      paginateQuery<SiteAuditCheck>(
        (sb, range) =>
          sb
            .from('site_audit_checks')
            .select('*')
            .eq('audit_id', auditId)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
      paginateQuery<SiteAuditPage>(
        (sb, range) =>
          sb
            .from('site_audit_pages')
            .select('*')
            .eq('audit_id', auditId)
            .order('crawled_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
    ])

    return {
      audit: audit as SiteAudit,
      checks,
      pages,
    }
  } catch (err) {
    console.error('[Shared Site Audit Error]', {
      type: 'paginated_fetch_failed',
      auditId,
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return null
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

/**
 * Fetch unified audit data for a shared link
 * Uses service client to bypass RLS for public access
 */
export async function getSharedUnifiedAuditData(
  auditId: string
): Promise<SharedUnifiedAuditData | null> {
  const supabase = await createServiceClient()

  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (auditError || !audit) {
    console.error('[Shared Unified Audit Error]', {
      type: 'audit_fetch_failed',
      auditId,
      error: auditError?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  try {
    const [checks, pages] = await Promise.all([
      paginateQuery<AuditCheck>(
        (sb, range) =>
          sb
            .from('audit_checks')
            .select('*')
            .eq('audit_id', auditId)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
      paginateQuery<AuditPage>(
        (sb, range) =>
          sb
            .from('audit_pages')
            .select('*')
            .eq('audit_id', auditId)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
    ])

    return {
      audit: audit as UnifiedAudit,
      checks,
      pages,
    }
  } catch (err) {
    console.error('[Shared Unified Audit Error]', {
      type: 'paginated_fetch_failed',
      auditId,
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return null
  }
}
