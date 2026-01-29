'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getOrganizations } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import type { SiteAudit, SiteAuditCheck } from '@/lib/audit/types'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit, AIOCheck } from '@/lib/aio/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type {
  GeneratedReport,
  GeneratedReportWithAudits,
  ReportGenerationInput,
  ReportUpdateInput,
  ReportValidationResult,
} from '@/lib/reports/types'
import { validateReportAudits, calculateCombinedScore, generateReportSummary } from '@/lib/reports'
import { AuditStatus, PerformanceAuditStatus, AIOAuditStatus } from '@/lib/enums'

// ============================================================
// DATA FETCHING
// ============================================================

export interface ReportsPageData {
  reports: GeneratedReport[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

/**
 * Get reports list data for the reports page
 */
export async function getReportsPageData(organizationId?: string): Promise<ReportsPageData> {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser

  // Determine the filter organization
  const filterOrgId = isInternal ? organizationId || null : userOrgId

  // Build reports query
  let reportsQuery = supabase
    .from('generated_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    reportsQuery = reportsQuery.eq('organization_id', filterOrgId)
  }

  const { data: reports, error } = await reportsQuery

  if (error) {
    console.error('[Get Reports Error]', {
      type: 'reports_fetch_failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }

  // Get organizations for selector
  const orgs = await getOrganizations()
  const organizations: OrganizationForSelector[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    website_url: org.website_url,
    status: org.status,
    logo_url: org.logo_url,
  }))

  return {
    reports: (reports ?? []) as GeneratedReport[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}

/**
 * Get a single report with all related audit data
 */
export async function getReportWithAudits(reportId: string): Promise<GeneratedReportWithAudits> {
  const supabase = await createClient()

  // Fetch report with joined audits
  const { data: report, error } = await supabase
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

  if (error || !report) {
    console.error('[Get Report Error]', {
      type: 'report_not_found',
      reportId,
      error: error?.message,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  // Fetch performance results
  const { data: performanceResults } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', report.performance_audit_id)

  return {
    ...report,
    performance_results: performanceResults ?? [],
  } as GeneratedReportWithAudits
}

// ============================================================
// AUDIT ELIGIBILITY
// ============================================================

export interface EligibleAuditsResult {
  siteAudit: SiteAudit | null
  performanceAudit: PerformanceAudit | null
  performanceResults: PerformanceAuditResult[]
  aioAudit: AIOAudit | null
  validation: ReportValidationResult
}

/**
 * Get the most recent eligible audits for a domain
 * Returns audits that can be combined into a report
 */
export async function getEligibleAuditsForDomain(
  domain: string,
  organizationId: string | null
): Promise<EligibleAuditsResult> {
  const supabase = await createClient()

  // Search for SEO audit by URL pattern
  let siteQuery = supabase
    .from('site_audits')
    .select('*')
    .eq('status', AuditStatus.Completed)
    .order('created_at', { ascending: false })
    .limit(1)

  if (organizationId) {
    siteQuery = siteQuery.eq('organization_id', organizationId)
  }

  // Use ilike for domain matching (handles www prefix, different protocols)
  siteQuery = siteQuery.ilike('url', `%${domain}%`)

  const { data: siteAudits } = await siteQuery
  const siteAudit = (siteAudits?.[0] as SiteAudit) ?? null

  // Search for performance audit
  let perfQuery = supabase
    .from('performance_audits')
    .select('*')
    .eq('status', PerformanceAuditStatus.Completed)
    .order('created_at', { ascending: false })
    .limit(1)

  if (organizationId) {
    perfQuery = perfQuery.eq('organization_id', organizationId)
  }

  const { data: perfAudits } = await perfQuery
  const performanceAudit = (perfAudits?.[0] as PerformanceAudit) ?? null

  // Get performance results for domain matching and score calculation
  let performanceResults: PerformanceAuditResult[] = []
  if (performanceAudit) {
    const { data: results } = await supabase
      .from('performance_audit_results')
      .select('*')
      .eq('audit_id', performanceAudit.id)
      .ilike('url', `%${domain}%`)

    performanceResults = (results ?? []) as PerformanceAuditResult[]
  }

  // Search for AIO audit
  let aioQuery = supabase
    .from('aio_audits')
    .select('*')
    .eq('status', AIOAuditStatus.Completed)
    .order('created_at', { ascending: false })
    .limit(1)

  if (organizationId) {
    aioQuery = aioQuery.eq('organization_id', organizationId)
  }

  aioQuery = aioQuery.ilike('url', `%${domain}%`)

  const { data: aioAudits } = await aioQuery
  const aioAudit = (aioAudits?.[0] as AIOAudit) ?? null

  // Validate the combination
  const validation = validateReportAudits(siteAudit, performanceAudit, performanceResults, aioAudit)

  return {
    siteAudit,
    performanceAudit,
    performanceResults,
    aioAudit,
    validation,
  }
}

/**
 * Validate specific audits for report generation
 */
export async function validateAuditsForReport(
  siteAuditId: string,
  performanceAuditId: string,
  aioAuditId: string
): Promise<ReportValidationResult> {
  const supabase = await createClient()

  // Fetch all audits
  const [siteResult, perfResult, aioResult] = await Promise.all([
    supabase.from('site_audits').select('*').eq('id', siteAuditId).single(),
    supabase.from('performance_audits').select('*').eq('id', performanceAuditId).single(),
    supabase.from('aio_audits').select('*').eq('id', aioAuditId).single(),
  ])

  const siteAudit = siteResult.data as SiteAudit | null
  const performanceAudit = perfResult.data as PerformanceAudit | null
  const aioAudit = aioResult.data as AIOAudit | null

  // Get performance results
  let performanceResults: PerformanceAuditResult[] = []
  if (performanceAudit) {
    const { data } = await supabase
      .from('performance_audit_results')
      .select('*')
      .eq('audit_id', performanceAuditId)

    performanceResults = (data ?? []) as PerformanceAuditResult[]
  }

  return validateReportAudits(siteAudit, performanceAudit, performanceResults, aioAudit)
}

// ============================================================
// REPORT CRUD
// ============================================================

export interface CreateReportResult {
  success: boolean
  reportId?: string
  error?: string
}

/**
 * Create a new report from validated audits
 */
export async function createReport(input: ReportGenerationInput): Promise<CreateReportResult> {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate the audits first
  const validation = await validateAuditsForReport(
    input.site_audit_id,
    input.performance_audit_id,
    input.aio_audit_id
  )

  if (!validation.is_valid) {
    return {
      success: false,
      error: validation.errors.join('. '),
    }
  }

  // Get scores for combined calculation
  const seoScore = validation.audits.site_audit.score
  const pageSpeedScore = validation.audits.performance_audit.score
  const aioScore = validation.audits.aio_audit.score

  const combinedScore = calculateCombinedScore(seoScore, pageSpeedScore, aioScore)
  const domain = validation.audits.site_audit.domain ?? ''

  // Get the site audit's organization
  const { data: siteAudit } = await supabase
    .from('site_audits')
    .select('organization_id')
    .eq('id', input.site_audit_id)
    .single()

  // Create the report
  const { data: report, error } = await supabase
    .from('generated_reports')
    .insert({
      organization_id: siteAudit?.organization_id ?? null,
      created_by: currentUser.id,
      site_audit_id: input.site_audit_id,
      performance_audit_id: input.performance_audit_id,
      aio_audit_id: input.aio_audit_id,
      combined_score: combinedScore,
      domain,
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

  revalidatePath('/seo/reports')
  return { success: true, reportId: report.id }
}

/**
 * Update report settings (summary, branding)
 */
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
    console.error('[Update Report Error]', {
      type: 'update_failed',
      reportId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to update report' }
  }

  revalidatePath('/seo/reports')
  revalidatePath(`/seo/reports/${reportId}`)
  return { success: true }
}

/**
 * Update executive summary with AI-generated content
 * Stores the original summary for restore functionality
 */
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

  // If this is the original AI-generated summary, store it
  if (isOriginal) {
    updateData.original_executive_summary = summary
  }

  const { error } = await supabase.from('generated_reports').update(updateData).eq('id', reportId)

  if (error) {
    console.error('[Update Summary Error]', {
      type: 'update_failed',
      reportId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to update summary' }
  }

  revalidatePath(`/seo/reports/${reportId}`)
  return { success: true }
}

/**
 * Restore executive summary to original AI-generated version
 */
export async function restoreOriginalSummary(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Get the original summary
  const { data: report, error: fetchError } = await supabase
    .from('generated_reports')
    .select('original_executive_summary')
    .eq('id', reportId)
    .single()

  if (fetchError || !report) {
    return { success: false, error: 'Report not found' }
  }

  if (!report.original_executive_summary) {
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

  revalidatePath(`/seo/reports/${reportId}`)
  return { success: true }
}

/**
 * Delete a report
 */
export async function deleteReport(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Authentication check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Authorization check - get user's organization, role, and internal status
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { success: false, error: 'User not found' }
  }

  // Only admins and internal users (developers) can delete reports
  const isAdmin = userRecord.role === 'admin'
  const isInternal = userRecord.is_internal

  if (!isAdmin && !isInternal) {
    console.error('[Delete Report Error]', {
      type: 'unauthorized',
      userId: user.id,
      role: userRecord.role,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: "You don't have permission to delete reports" }
  }

  // Build delete query with organization filter for non-internal users
  let deleteQuery = supabase.from('generated_reports').delete().eq('id', reportId)

  // Non-internal users can only delete reports from their organization
  if (!isInternal && userRecord.organization_id) {
    deleteQuery = deleteQuery.eq('organization_id', userRecord.organization_id)
  }

  const { error } = await deleteQuery

  if (error) {
    console.error('[Delete Report Error]', {
      type: 'delete_failed',
      reportId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { success: false, error: 'Failed to delete report' }
  }

  revalidatePath('/seo/reports')
  return { success: true }
}

// ============================================================
// AUDIT DATA FOR REPORT PRESENTATION
// ============================================================

export interface ReportAuditData {
  siteChecks: SiteAuditCheck[]
  performanceResults: PerformanceAuditResult[]
  aioChecks: AIOCheck[]
}

/**
 * Get all audit checks and results for report presentation
 */
export async function getReportAuditData(
  report: GeneratedReportWithAudits
): Promise<ReportAuditData> {
  const supabase = await createClient()

  // Fetch site audit checks
  const { data: siteChecks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', report.site_audit_id)
    .order('created_at', { ascending: true })

  // Performance results are already in the report
  const performanceResults = report.performance_results ?? []

  // Fetch AIO checks
  const { data: aioChecks } = await supabase
    .from('aio_checks')
    .select('*')
    .eq('audit_id', report.aio_audit_id)
    .order('created_at', { ascending: true })

  return {
    siteChecks: (siteChecks ?? []) as SiteAuditCheck[],
    performanceResults,
    aioChecks: (aioChecks ?? []) as AIOCheck[],
  }
}

// ============================================================
// REPORT COUNT FOR AUDIT DELETION WARNING
// ============================================================

/**
 * Count reports that depend on a specific audit
 * Used to warn before audit deletion
 */
export async function countReportsUsingAudit(
  auditType: 'site_audit' | 'performance_audit' | 'aio_audit',
  auditId: string
): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('generated_reports')
    .select('*', { count: 'exact', head: true })
    .eq(`${auditType}_id`, auditId)

  if (error) {
    console.error('[Count Reports Error]', {
      type: 'count_failed',
      auditType,
      auditId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return 0
  }

  return count ?? 0
}

// ============================================================
// EXECUTIVE SUMMARY GENERATION
// ============================================================

/**
 * Generate an AI-powered executive summary for a report
 */
export async function generateSummaryForReport(
  reportId: string
): Promise<{ success: boolean; summary?: string; error?: string }> {
  // Get report with all audit data
  const report = await getReportWithAudits(reportId)
  const auditData = await getReportAuditData(report)

  // Calculate scores
  const seoScore = report.site_audit.overall_score ?? 0
  const aioScore = report.aio_audit.overall_aio_score ?? 0

  // Calculate average performance score
  const perfScores = auditData.performanceResults
    .map((r) => r.performance_score)
    .filter((s): s is number => s !== null)
  const pageSpeedScore =
    perfScores.length > 0
      ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
      : 0

  const combinedScore = report.combined_score ?? 0

  try {
    const summary = await generateReportSummary({
      domain: report.domain,
      combinedScore,
      seoScore,
      pageSpeedScore,
      aioScore,
      siteAudit: report.site_audit,
      siteChecks: auditData.siteChecks,
      performanceResults: auditData.performanceResults,
      aioAudit: report.aio_audit,
      aioChecks: auditData.aioChecks,
    })

    // Save the summary (mark as original if no summary exists yet)
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
