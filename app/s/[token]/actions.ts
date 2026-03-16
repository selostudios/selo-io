'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import type { SiteAuditCheck, SiteAuditPage, SiteAudit } from '@/lib/audit/types'
import type { UnifiedAudit, AuditCheck, AuditPage } from '@/lib/unified-audit/types'
import type { ReportPresentationData } from '@/lib/reports/types'
import { transformToPresentation } from '@/app/(authenticated)/[orgId]/seo/client-reports/[id]/transform'
import type {
  ReportCheck,
  ReportAuditData,
} from '@/app/(authenticated)/[orgId]/seo/client-reports/actions'

// =============================================================================
// Explicit column selects (cast as '*' to satisfy Supabase's deep type inference)
// =============================================================================

const SITE_AUDIT_SELECT = `id, organization_id, created_by, url, status, overall_score, seo_score,
  ai_readiness_score, technical_score, pages_crawled, failed_count,
  warning_count, passed_count, executive_summary, error_message,
  archived_at, started_at, completed_at, created_at` as '*'

const SITE_CHECK_SELECT = `id, audit_id, page_id, check_type, check_name, priority, status,
  details, created_at, display_name, display_name_passed,
  learn_more_url, is_site_wide, description, fix_guidance` as '*'

const SITE_PAGE_SELECT = `id, audit_id, url, title, meta_description, status_code,
  last_modified, crawled_at, is_resource, resource_type` as '*'

const UNIFIED_AUDIT_SELECT = `id, organization_id, created_by, domain, url, status,
  seo_score, performance_score, ai_readiness_score, overall_score,
  pages_crawled, crawl_mode, max_pages, soft_cap_reached,
  passed_count, warning_count, failed_count,
  ai_analysis_enabled, sample_size,
  total_input_tokens, total_output_tokens, total_cost,
  use_relaxed_ssl, executive_summary, error_message,
  started_at, completed_at, created_at, updated_at` as '*'

const AUDIT_CHECK_SELECT = `id, audit_id, page_url, category, check_name, priority, status,
  display_name, display_name_passed, description, fix_guidance,
  learn_more_url, details, feeds_scores, created_at` as '*'

const AUDIT_PAGE_SELECT = `id, audit_id, url, title, meta_description, status_code,
  last_modified, is_resource, resource_type, depth, created_at` as '*'

const PERF_RESULT_SELECT = `id, audit_id, url, device, lcp_ms, lcp_rating, inp_ms, inp_rating,
  cls_score, cls_rating, performance_score, accessibility_score,
  best_practices_score, seo_score, created_at` as '*'

// =============================================================================
// Types
// =============================================================================

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
    .select(SITE_AUDIT_SELECT)
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
            .select(SITE_CHECK_SELECT)
            .eq('audit_id', auditId)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
      paginateQuery<SiteAuditPage>(
        (sb, range) =>
          sb
            .from('site_audit_pages')
            .select(SITE_PAGE_SELECT)
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

  const [{ data: performanceResults }, { data: siteChecks }, { data: aioChecks }] =
    await Promise.all([
      supabase
        .from('performance_audit_results')
        .select(PERF_RESULT_SELECT)
        .eq('audit_id', report.performance_audit_id),
      supabase
        .from('site_audit_checks')
        .select(SITE_CHECK_SELECT)
        .eq('audit_id', report.site_audit_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('aio_checks')
        .select(SITE_CHECK_SELECT)
        .eq('audit_id', report.aio_audit_id)
        .order('created_at', { ascending: true }),
    ])

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
    siteChecks: (siteChecks ?? []) as unknown as ReportCheck[],
    performanceResults: (performanceResults ??
      []) as unknown as ReportAuditData['performanceResults'],
    aioChecks: (aioChecks ?? []) as unknown as ReportCheck[],
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
    .select(UNIFIED_AUDIT_SELECT)
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
            .select(AUDIT_CHECK_SELECT)
            .eq('audit_id', auditId)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
      paginateQuery<AuditPage>(
        (sb, range) =>
          sb
            .from('audit_pages')
            .select(AUDIT_PAGE_SELECT)
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
