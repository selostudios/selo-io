'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { getAuthUser, getUserRecord, getOrganizationsList } from '@/lib/auth/cached'
import { getCurrentUser } from '@/lib/organizations/actions'
import { isInternalUser } from '@/lib/permissions'
import { UserRole, UnifiedAuditStatus } from '@/lib/enums'
import type { UnifiedAudit, AuditCheck } from '@/lib/unified-audit/types'
import type {
  GeneratedReport,
  GeneratedReportWithAudits,
  ReportUpdateInput,
} from '@/lib/reports/types'
import { calculateCombinedScore } from '@/lib/reports'
import { generateReportSummary } from '@/lib/reports/summary-generator'
import type { SiteAuditCheck } from '@/lib/audit/types'
import type { PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOCheck } from '@/lib/aio/types'
import type { AuditListBaseResult } from '@/lib/actions/audit-list-helpers'

// =============================================================================
// List Page Data
// =============================================================================

export interface ClientReportsPageData extends AuditListBaseResult {
  audits: UnifiedAudit[]
  /** Map of audit ID → report ID for audits that already have reports */
  auditReportMap: Record<string, string>
  /** Existing reports (for legacy reports not linked to unified audits) */
  legacyReports: GeneratedReport[]
}

const AUDIT_SELECT = `
  id, organization_id, created_by, domain, url, status,
  seo_score, performance_score, ai_readiness_score, overall_score,
  pages_crawled, crawl_mode, max_pages,
  passed_count, warning_count, failed_count,
  executive_summary, error_message,
  started_at, completed_at, created_at
`

export async function getClientReportsPageData(
  organizationId?: string
): Promise<ClientReportsPageData> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) redirect('/login')

  const internal = isInternalUser(userRecord)
  const filterOrgId = internal ? organizationId || null : userRecord.organization_id

  // Fetch completed unified audits
  let query = supabase
    .from('audits')
    .select(AUDIT_SELECT)
    .eq('status', UnifiedAuditStatus.Completed)
    .not('overall_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (filterOrgId) {
    query = query.eq('organization_id', filterOrgId)
  } else if (!internal) {
    query = query.is('organization_id', null).eq('created_by', user.id)
  }

  // Fetch reports linked to unified audits
  let reportsQuery = supabase
    .from('generated_reports')
    .select('id, audit_id, domain, combined_score, view_count, created_at, organization_id')
    .not('audit_id', 'is', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    reportsQuery = reportsQuery.eq('organization_id', filterOrgId)
  } else if (!internal) {
    reportsQuery = reportsQuery.is('organization_id', null)
  }

  // Fetch legacy reports (no audit_id, linked to old separate audits)
  let legacyReportsQuery = supabase
    .from('generated_reports')
    .select('*')
    .is('audit_id', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    legacyReportsQuery = legacyReportsQuery.eq('organization_id', filterOrgId)
  } else if (!internal) {
    legacyReportsQuery = legacyReportsQuery.is('organization_id', null)
  }

  const [{ data: audits }, { data: reports }, { data: legacyReports }, organizations] =
    await Promise.all([query, reportsQuery, legacyReportsQuery, getOrganizationsList()])

  // Build audit → report mapping
  const auditReportMap: Record<string, string> = {}
  for (const report of reports ?? []) {
    if (report.audit_id) {
      auditReportMap[report.audit_id] = report.id
    }
  }

  return {
    audits: (audits ?? []) as UnifiedAudit[],
    auditReportMap,
    legacyReports: (legacyReports ?? []) as GeneratedReport[],
    organizations,
    isInternal: internal,
    selectedOrganizationId: filterOrgId,
  }
}

// =============================================================================
// Create Report from Unified Audit
// =============================================================================

export interface CreateReportResult {
  success: boolean
  reportId?: string
  error?: string
}

export async function createReportFromAudit(auditId: string): Promise<CreateReportResult> {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  // Only admins and internal users can create reports
  const { data: rawCreateUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(role)')
    .eq('id', currentUser.id)
    .single()

  const createRole =
    (rawCreateUser?.team_members as { role: string }[])?.[0]?.role ?? 'client_viewer'

  if (!rawCreateUser) {
    return { success: false, error: 'User not found' }
  }

  const isAdmin = createRole === UserRole.Admin
  const isInternal = rawCreateUser.is_internal === true
  if (!isAdmin && !isInternal) {
    return { success: false, error: 'You do not have permission to create reports' }
  }

  // Fetch the unified audit
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (auditError || !audit) {
    return { success: false, error: 'Audit not found' }
  }

  if (audit.status !== UnifiedAuditStatus.Completed) {
    return { success: false, error: 'Audit must be completed to create a report' }
  }

  // Check if a report already exists for this audit
  const { data: existing } = await supabase
    .from('generated_reports')
    .select('id')
    .eq('audit_id', auditId)
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, reportId: existing[0].id }
  }

  // Calculate combined score from the unified audit's scores
  const combinedScore = calculateCombinedScore(
    audit.seo_score,
    audit.performance_score,
    audit.ai_readiness_score
  )

  // Create the report linked to the unified audit
  const { data: report, error } = await supabase
    .from('generated_reports')
    .insert({
      organization_id: audit.organization_id ?? null,
      created_by: currentUser.id,
      audit_id: auditId,
      combined_score: combinedScore,
      domain: audit.domain,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Create Report Error]', {
      type: 'insert_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to create report' }
  }

  revalidatePath('/seo/client-reports')
  return { success: true, reportId: report.id }
}

// =============================================================================
// Report Detail (supports both unified and legacy reports)
// =============================================================================

export async function getReportWithAudits(reportId: string): Promise<GeneratedReportWithAudits> {
  const supabase = await createClient()

  // Fetch report with organization branding
  const { data: report, error } = await supabase
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

  if (error || !report) {
    console.error('[Get Report Error]', {
      type: 'report_not_found',
      reportId,
      error: error?.message,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  // Fetch performance results (for legacy reports only)
  let performanceResults: unknown[] = []
  if (report.performance_audit_id) {
    const { data } = await supabase
      .from('performance_audit_results')
      .select('*')
      .eq('audit_id', report.performance_audit_id)
    performanceResults = data ?? []
  }

  const org = report.organization
  return {
    ...report,
    performance_results: performanceResults,
    org_name: org?.name ?? null,
    org_logo_url: org?.logo_url ?? null,
    primary_color: org?.primary_color ?? null,
    secondary_color: org?.secondary_color ?? null,
    accent_color: org?.accent_color ?? null,
  } as GeneratedReportWithAudits
}

/**
 * Fetch the unified audit scores for a report.
 * Returns null for legacy reports (no `audit_id`) or if the audit can't be loaded.
 */
export async function getUnifiedAuditForReport(
  auditId: string | null
): Promise<Pick<
  UnifiedAudit,
  'seo_score' | 'performance_score' | 'ai_readiness_score' | 'pages_crawled'
> | null> {
  if (!auditId) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audits')
    .select('seo_score, performance_score, ai_readiness_score, pages_crawled')
    .eq('id', auditId)
    .single()

  if (error || !data) {
    console.error('[Get Unified Audit For Report Error]', {
      type: 'audit_fetch_failed',
      auditId,
      error: error?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return data as Pick<
    UnifiedAudit,
    'seo_score' | 'performance_score' | 'ai_readiness_score' | 'pages_crawled'
  >
}

/** Common check shape for report transformation — works with both unified and legacy checks */
export interface ReportCheck {
  id: string
  check_name: string
  status: string
  priority: string
  display_name: string | null | undefined
  description: string | null | undefined
  fix_guidance: string | null | undefined
  [key: string]: unknown
}

export interface ReportAuditData {
  siteChecks: ReportCheck[]
  performanceResults: {
    id: string
    url: string
    device: string
    performance_score: number | null
    [key: string]: unknown
  }[]
  aioChecks: ReportCheck[]
}

export async function getReportAuditData(
  report: GeneratedReportWithAudits
): Promise<ReportAuditData> {
  const supabase = await createClient()

  // For unified audit reports, read from audit_checks
  const reportRecord = report as GeneratedReportWithAudits & { audit_id?: string }
  if (reportRecord.audit_id) {
    const { data: allChecks } = await supabase
      .from('audit_checks')
      .select('*')
      .eq('audit_id', reportRecord.audit_id)
      .order('created_at', { ascending: true })

    const checks = (allChecks ?? []) as AuditCheck[]

    // Split checks: performance checks go to performanceResults area,
    // SEO and AI checks go to siteChecks/aioChecks
    const seoCategories = [
      'meta_content',
      'crawlability',
      'links',
      'media',
      'content_quality',
      'content_structure',
    ]
    const performanceCategories = ['performance']
    const aiCategories = ['structured_data', 'ai_visibility']

    // Build performance results from performance checks
    const perfChecks = checks.filter((c) => performanceCategories.includes(c.category))
    const performanceResults = perfChecks.map((c) => ({
      id: c.id,
      url: c.page_url || '',
      device: 'mobile',
      performance_score:
        ((c.details as Record<string, unknown>)?.performance as number | null) ?? null,
    }))

    return {
      siteChecks: checks.filter((c) =>
        seoCategories.includes(c.category)
      ) as unknown as ReportCheck[],
      performanceResults,
      aioChecks: checks.filter((c) =>
        aiCategories.includes(c.category)
      ) as unknown as ReportCheck[],
    }
  }

  // Legacy: read from old tables
  const { data: siteChecks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', report.site_audit_id)
    .order('created_at', { ascending: true })

  const performanceResults = report.performance_results ?? []

  const { data: aioChecks } = await supabase
    .from('aio_checks')
    .select('*')
    .eq('audit_id', report.aio_audit_id)
    .order('created_at', { ascending: true })

  return {
    siteChecks: (siteChecks ?? []) as ReportCheck[],
    performanceResults: performanceResults as unknown as ReportAuditData['performanceResults'],
    aioChecks: (aioChecks ?? []) as ReportCheck[],
  }
}

// =============================================================================
// Report CRUD (kept from old actions)
// =============================================================================

export async function updateReport(
  reportId: string,
  input: ReportUpdateInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('generated_reports')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (error) {
    return { success: false, error: 'Failed to update report' }
  }

  revalidatePath('/seo/client-reports')
  revalidatePath(`/seo/client-reports/${reportId}`)
  return { success: true }
}

export async function updateExecutiveSummary(
  reportId: string,
  summary: string,
  isOriginal: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    executive_summary: summary,
    updated_at: new Date().toISOString(),
  }

  if (isOriginal) {
    updateData.original_executive_summary = summary
  }

  const { error } = await supabase.from('generated_reports').update(updateData).eq('id', reportId)

  if (error) {
    return { success: false, error: 'Failed to update summary' }
  }

  try {
    revalidatePath(`/seo/client-reports/${reportId}`)
  } catch {
    // revalidatePath throws when called outside a server action (e.g. during RSC render)
  }
  return { success: true }
}

export async function restoreOriginalSummary(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: report, error: fetchError } = await supabase
    .from('generated_reports')
    .select('original_executive_summary')
    .eq('id', reportId)
    .single()

  if (fetchError || !report || !report.original_executive_summary) {
    return { success: false, error: 'No original summary available' }
  }

  const { error } = await supabase
    .from('generated_reports')
    .update({
      executive_summary: report.original_executive_summary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (error) {
    return { success: false, error: 'Failed to restore summary' }
  }

  revalidatePath(`/seo/client-reports/${reportId}`)
  return { success: true }
}

export async function deleteReport(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: rawDeleteUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const deleteMembership = (
    rawDeleteUser?.team_members as { organization_id: string; role: string }[]
  )?.[0]
  const deleteUserRecord = rawDeleteUser
    ? {
        organization_id: deleteMembership?.organization_id ?? null,
        role: deleteMembership?.role ?? 'client_viewer',
        is_internal: rawDeleteUser.is_internal,
      }
    : null

  if (!deleteUserRecord) {
    return { success: false, error: 'User not found' }
  }

  const isAdmin = deleteUserRecord.role === UserRole.Admin
  const isInternal = deleteUserRecord.is_internal

  if (!isAdmin && !isInternal) {
    return { success: false, error: "You don't have permission to delete reports" }
  }

  let deleteQuery = supabase.from('generated_reports').delete().eq('id', reportId)

  if (!isInternal && deleteUserRecord.organization_id) {
    deleteQuery = deleteQuery.eq('organization_id', deleteUserRecord.organization_id)
  }

  const { error } = await deleteQuery

  if (error) {
    return { success: false, error: 'Failed to delete report' }
  }

  revalidatePath('/seo/client-reports')
  return { success: true }
}

// =============================================================================
// Executive Summary Generation
// =============================================================================

export async function generateSummaryForReport(
  reportId: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  const report = await getReportWithAudits(reportId)
  const auditData = await getReportAuditData(report)

  const seoScore = report.site_audit?.overall_score ?? 0
  const aioScore = report.aio_audit?.overall_aio_score ?? 0

  // For unified audit reports, use the stored performance score
  const reportRecord = report as GeneratedReportWithAudits & { audit_id?: string }
  let pageSpeedScore = 0
  if (reportRecord.audit_id) {
    // Get from the unified audit directly
    const supabase = await createClient()
    const { data: audit } = await supabase
      .from('audits')
      .select('performance_score')
      .eq('id', reportRecord.audit_id)
      .single()
    pageSpeedScore = audit?.performance_score ?? 0
  } else {
    const perfResults = auditData.performanceResults as { performance_score?: number | null }[]
    const perfScores = perfResults
      .map((r) => r.performance_score)
      .filter((s): s is number => s !== null)
    pageSpeedScore =
      perfScores.length > 0
        ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
        : 0
  }

  const combinedScore = report.combined_score ?? 0

  try {
    const summary = await generateReportSummary({
      domain: report.domain,
      combinedScore,
      seoScore,
      pageSpeedScore,
      aioScore,
      siteAudit: report.site_audit,
      siteChecks: auditData.siteChecks as unknown as SiteAuditCheck[],
      performanceResults: auditData.performanceResults as unknown as PerformanceAuditResult[],
      aioAudit: report.aio_audit,
      aioChecks: auditData.aioChecks as unknown as AIOCheck[],
    })

    const isOriginal = !report.executive_summary
    await updateExecutiveSummary(reportId, summary, isOriginal)

    return { success: true, summary }
  } catch (error) {
    console.error('[Generate Summary Error]', {
      type: 'generation_failed',
      reportId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to generate summary' }
  }
}

export async function countReportsUsingAudit(
  auditType: 'site_audit' | 'performance_audit' | 'aio_audit',
  auditId: string
): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('generated_reports')
    .select('*', { count: 'exact', head: true })
    .eq(`${auditType}_id`, auditId)

  if (error) return 0
  return count ?? 0
}
