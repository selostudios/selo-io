'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import { ScoreDimension } from '@/lib/enums'
import type { SiteAuditCheck, SiteAuditPage, SiteAudit } from '@/lib/audit/types'
import type { UnifiedAudit, AuditCheck } from '@/lib/unified-audit/types'
import type { TabCounts } from '@/app/(authenticated)/[orgId]/seo/audit/[id]/actions'
import type { ReportPresentationData } from '@/lib/reports/types'
import { transformToPresentation } from '@/app/(authenticated)/[orgId]/reports/audit/[id]/transform'
import type {
  ReportCheck,
  ReportAuditData,
} from '@/app/(authenticated)/[orgId]/reports/audit/actions'
import { fetchUnifiedAuditScores } from '@/lib/reports/unified-audit-fetch'
import { formatQuarterLabel } from '@/lib/reviews/period'
import { isSlideKey, type SlideKey } from '@/lib/reviews/slides/registry'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

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
  tabCounts: TabCounts
}

export interface SharedMarketingReviewData {
  organization: {
    name: string
    logo_url: string | null
    primary_color: string | null
  }
  quarter: string
  periodStart: string
  periodEnd: string
  narrative: NarrativeBlocks
  data: SnapshotData
  hiddenSlides: readonly SlideKey[]
  version: number
  publishedAt: string | null
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

  // For unified-audit reports, fetch scores from the audits table via the shared helper.
  const unifiedAudit = await fetchUnifiedAuditScores(supabase, report.audit_id)

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

  return transformToPresentation({
    report: reportWithAudits,
    audit: unifiedAudit,
    auditData,
  })
}

/**
 * Fetch unified audit overview for a shared link (audit + tab counts, no full checks).
 * Uses service client to bypass RLS for public access.
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

  const CHECK_SUMMARY_SELECT = 'status, priority, check_name, feeds_scores' as '*'
  const checkSummary = await paginateQuery<{
    status: string
    priority: string
    check_name: string
    feeds_scores: string[]
  }>(
    (sb, range) =>
      sb
        .from('audit_checks')
        .select(CHECK_SUMMARY_SELECT)
        .eq('audit_id', auditId)
        .order('created_at', { ascending: true })
        .range(range.from, range.to),
    supabase
  )

  const tabCounts = computeSharedTabCounts(checkSummary)

  return {
    audit: audit as UnifiedAudit,
    tabCounts,
  }
}

/**
 * Fetch checks for a specific tab on a shared unified audit.
 * Called client-side when switching tabs on the shared page.
 */
export async function getSharedChecksByTab(
  auditId: string,
  tab: 'top_issues' | 'seo' | 'performance' | 'ai_readiness'
): Promise<AuditCheck[]> {
  const supabase = await createServiceClient()

  const dimensionMap: Record<string, ScoreDimension> = {
    seo: ScoreDimension.SEO,
    performance: ScoreDimension.Performance,
    ai_readiness: ScoreDimension.AIReadiness,
  }

  if (tab === 'top_issues') {
    return paginateQuery<AuditCheck>((sb, range) => {
      return sb
        .from('audit_checks')
        .select(AUDIT_CHECK_SELECT)
        .eq('audit_id', auditId)
        .in('status', ['failed', 'warning'])
        .in('priority', ['critical', 'recommended'])
        .order('created_at', { ascending: true })
        .range(range.from, range.to)
    }, supabase)
  }

  const dimension = dimensionMap[tab]

  return paginateQuery<AuditCheck>((sb, range) => {
    let query = sb.from('audit_checks').select(AUDIT_CHECK_SELECT).eq('audit_id', auditId)

    if (dimension) {
      query = query.contains('feeds_scores', [dimension])
    }

    return query.order('created_at', { ascending: true }).range(range.from, range.to)
  }, supabase)
}

/**
 * Fetch a published performance review snapshot for a shared link.
 *
 * Token validation + access logging already happened in `accessSharedLink`
 * (called by the `/s/[token]` client before this loader runs), so this
 * function receives the resolved `snapshotId` and loads the snapshot, its
 * parent review, and the organization that owns it.
 *
 * Uses the service client to bypass RLS for public access.
 */
export async function getSharedMarketingReviewData(
  snapshotId: string
): Promise<SharedMarketingReviewData | null> {
  const supabase = await createServiceClient()

  const { data: snapshot, error: snapshotError } = await supabase
    .from('marketing_review_snapshots')
    .select(
      'id, review_id, version, period_start, period_end, data, narrative, hidden_slides, published_at'
    )
    .eq('id', snapshotId)
    .maybeSingle()

  if (snapshotError || !snapshot) {
    console.error('[Shared Marketing Review Error]', {
      type: 'snapshot_fetch_failed',
      snapshotId,
      error: snapshotError?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const { data: review, error: reviewError } = await supabase
    .from('marketing_reviews')
    .select('id, quarter, organization_id, title')
    .eq('id', snapshot.review_id as string)
    .maybeSingle()

  if (reviewError || !review) {
    console.error('[Shared Marketing Review Error]', {
      type: 'review_fetch_failed',
      snapshotId,
      reviewId: snapshot.review_id,
      error: reviewError?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, logo_url, primary_color')
    .eq('id', review.organization_id as string)
    .maybeSingle()

  if (orgError || !org) {
    console.error('[Shared Marketing Review Error]', {
      type: 'organization_fetch_failed',
      snapshotId,
      organizationId: review.organization_id,
      error: orgError?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const quarter = review.quarter as string
  const narrative = (snapshot.narrative as NarrativeBlocks | null) ?? {}
  const data = (snapshot.data as SnapshotData | null) ?? {}
  const hiddenSlides: SlideKey[] = ((snapshot.hidden_slides as string[] | null) ?? []).filter(
    (k): k is SlideKey => isSlideKey(k)
  )

  return {
    organization: {
      name: (org.name as string | null) ?? 'Organization',
      logo_url: (org.logo_url as string | null) ?? null,
      primary_color: (org.primary_color as string | null) ?? null,
    },
    quarter: formatQuarterLabel(quarter),
    periodStart: snapshot.period_start as string,
    periodEnd: snapshot.period_end as string,
    narrative,
    data,
    hiddenSlides,
    version: snapshot.version as number,
    publishedAt: (snapshot.published_at as string | null) ?? null,
  }
}

function computeSharedTabCounts(
  checks: { status: string; priority: string; check_name: string; feeds_scores: string[] }[]
): TabCounts {
  const empty = () => ({ total: 0, failed: 0, warning: 0, passed: 0 })
  const counts: TabCounts = {
    topIssues: empty(),
    seo: empty(),
    performance: empty(),
    aiReadiness: empty(),
  }

  const topIssueNames = new Set<string>()

  for (const c of checks) {
    const isActionable = c.status === 'failed' || c.status === 'warning'
    const isHighPriority = c.priority === 'critical' || c.priority === 'recommended'
    if (isActionable && isHighPriority && !topIssueNames.has(c.check_name)) {
      topIssueNames.add(c.check_name)
      counts.topIssues.total++
      if (c.status === 'failed') counts.topIssues.failed++
      else counts.topIssues.warning++
    }

    if (c.feeds_scores.includes(ScoreDimension.SEO)) {
      counts.seo.total++
      if (c.status === 'failed') counts.seo.failed++
      else if (c.status === 'warning') counts.seo.warning++
      else if (c.status === 'passed') counts.seo.passed++
    }
    if (c.feeds_scores.includes(ScoreDimension.Performance)) {
      counts.performance.total++
      if (c.status === 'failed') counts.performance.failed++
      else if (c.status === 'warning') counts.performance.warning++
      else if (c.status === 'passed') counts.performance.passed++
    }
    if (c.feeds_scores.includes(ScoreDimension.AIReadiness)) {
      counts.aiReadiness.total++
      if (c.status === 'failed') counts.aiReadiness.failed++
      else if (c.status === 'warning') counts.aiReadiness.warning++
      else if (c.status === 'passed') counts.aiReadiness.passed++
    }
  }

  return counts
}
