'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import { notFound } from 'next/navigation'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { canAccessAllAudits } from '@/lib/permissions'
import { ScoreDimension } from '@/lib/enums'
import { fetchPage } from '@/lib/audit/fetcher'
import { getCheckByName } from '@/lib/unified-audit/checks'
import { buildCheckRecord, executeModules } from '@/lib/unified-audit/runner'
import { getModule } from '@/lib/unified-audit/modules/registry'
import type { CheckContext, AuditPage, PostCrawlContext } from '@/lib/unified-audit/types'
import type { UnifiedAudit, AuditCheck, AuditAIAnalysis } from '@/lib/unified-audit/types'
import { revalidatePath } from 'next/cache'

// =============================================================================
// Types
// =============================================================================

// Explicit column selects to avoid fetching unused data
const AUDIT_SELECT = `id, organization_id, created_by, domain, url, status,
  seo_score, performance_score, ai_readiness_score, overall_score,
  pages_crawled, crawl_mode, max_pages,
  passed_count, warning_count, failed_count,
  executive_summary, error_message,
  module_timings, module_statuses, module_errors,
  started_at, completed_at, created_at` as '*'

const CHECK_SELECT = `id, audit_id, page_url, category, check_name, priority, status,
  display_name, display_name_passed, description, fix_guidance,
  learn_more_url, details, feeds_scores, created_at` as '*'

export interface StatusCounts {
  total: number
  failed: number
  warning: number
  passed: number
}

export interface TabCounts {
  topIssues: StatusCounts
  seo: StatusCounts
  performance: StatusCounts
  aiReadiness: StatusCounts
}

export interface UnifiedAuditOverviewData {
  audit: UnifiedAudit
  tabCounts: TabCounts
}

export interface UnifiedAuditReportData {
  audit: UnifiedAudit
  checks: AuditCheck[]
}

export interface UnifiedAuditDetailData extends UnifiedAuditReportData {
  aiAnalyses: AuditAIAnalysis[]
}

// =============================================================================
// Detail Actions
// =============================================================================

/**
 * Get full audit report data with checks and pages (paginated).
 * Used by the audit detail/report page.
 */
export async function getUnifiedAuditReport(id: string): Promise<UnifiedAuditReportData> {
  // Fetch auth (cached) and audit in parallel
  const supabase = await createClient()
  const [user, { data: audit, error: auditError }] = await Promise.all([
    getAuthUser(),
    supabase.from('audits').select(AUDIT_SELECT).eq('id', id).single(),
  ])

  if (!user) notFound()
  if (auditError || !audit) {
    console.error('[Get Unified Audit Report Error]', {
      type: 'audit_not_found',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  // getUserRecord is cached per-request, so this is free if layout already called it
  const userRecord = await getUserRecord(user.id)
  if (!userRecord) notFound()

  // Verify access
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) notFound()

  // Fetch checks (paginated for large audits)
  let checks: AuditCheck[]

  try {
    checks = await paginateQuery<AuditCheck>(
      (sb, range) =>
        sb
          .from('audit_checks')
          .select(CHECK_SELECT)
          .eq('audit_id', id)
          .order('created_at', { ascending: true })
          .range(range.from, range.to),
      supabase
    )
  } catch (err) {
    console.error('[Get Unified Audit Report Error]', {
      type: 'paginated_fetch_failed',
      auditId: id,
      error: err,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  return {
    audit: audit as UnifiedAudit,
    checks,
  }
}

/**
 * Get audit record with lightweight tab counts (no full checks).
 * Used by the audit detail page for initial render — checks are lazy-loaded per tab.
 */
export async function getAuditOverview(id: string): Promise<UnifiedAuditOverviewData> {
  const supabase = await createClient()
  const [user, { data: audit, error: auditError }] = await Promise.all([
    getAuthUser(),
    supabase.from('audits').select(AUDIT_SELECT).eq('id', id).single(),
  ])

  if (!user) notFound()
  if (auditError || !audit) {
    console.error('[Get Audit Overview Error]', {
      type: 'audit_not_found',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) notFound()

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) notFound()

  // Fetch lightweight summary for tab counts (paginated to handle large audits)
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
        .eq('audit_id', id)
        .order('created_at', { ascending: true })
        .range(range.from, range.to),
    supabase
  )

  const tabCounts = computeTabCounts(checkSummary)

  return {
    audit: audit as UnifiedAudit,
    tabCounts,
  }
}

function computeTabCounts(
  checks: { status: string; priority: string; check_name: string; feeds_scores: string[] }[]
): TabCounts {
  const empty = (): StatusCounts => ({ total: 0, failed: 0, warning: 0, passed: 0 })
  const counts: TabCounts = {
    topIssues: empty(),
    seo: empty(),
    performance: empty(),
    aiReadiness: empty(),
  }

  // Track unique check_names for top issues deduplication
  const topIssueNames = new Set<string>()

  for (const c of checks) {
    // Top Issues: unique critical/recommended failures and warnings
    const isActionable = c.status === 'failed' || c.status === 'warning'
    const isHighPriority = c.priority === 'critical' || c.priority === 'recommended'
    if (isActionable && isHighPriority && !topIssueNames.has(c.check_name)) {
      topIssueNames.add(c.check_name)
      counts.topIssues.total++
      if (c.status === 'failed') counts.topIssues.failed++
      else counts.topIssues.warning++
    }

    // Dimension-specific counts
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

/**
 * Get full audit detail data including AI analyses.
 * Used by the audit detail page when AI analysis tab is active.
 */
export async function getUnifiedAuditDetail(id: string): Promise<UnifiedAuditDetailData> {
  const report = await getUnifiedAuditReport(id)

  const supabase = await createClient()

  const { data: aiAnalyses } = await supabase
    .from('audit_ai_analyses')
    .select('*')
    .eq('audit_id', id)
    .order('importance_score', { ascending: false })

  return {
    ...report,
    aiAnalyses: (aiAnalyses ?? []) as AuditAIAnalysis[],
  }
}

/**
 * Get checks filtered by score dimension tab (SEO, Performance, AI Readiness, or all for overview).
 * Uses the feeds_scores array to filter relevant checks. Paginated for large audits.
 */
export async function getUnifiedAuditChecksByTab(
  auditId: string,
  tab: 'top_issues' | 'seo' | 'performance' | 'ai_readiness'
): Promise<AuditCheck[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  // Verify audit access
  const { data: audit } = await supabase
    .from('audits')
    .select('id, organization_id, created_by')
    .eq('id', auditId)
    .single()
  if (!audit) return []

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) return []

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)
  if (!hasAccess) return []

  const dimensionMap: Record<string, ScoreDimension> = {
    seo: ScoreDimension.SEO,
    performance: ScoreDimension.Performance,
    ai_readiness: ScoreDimension.AIReadiness,
  }

  if (tab === 'top_issues') {
    // Fetch only failed/warning checks with critical/recommended priority
    return paginateQuery<AuditCheck>((sb, range) => {
      return sb
        .from('audit_checks')
        .select(CHECK_SELECT)
        .eq('audit_id', auditId)
        .in('status', ['failed', 'warning'])
        .in('priority', ['critical', 'recommended'])
        .order('created_at', { ascending: true })
        .range(range.from, range.to)
    }, supabase)
  }

  const dimension = dimensionMap[tab]

  return paginateQuery<AuditCheck>((sb, range) => {
    let query = sb.from('audit_checks').select(CHECK_SELECT).eq('audit_id', auditId)

    if (dimension) {
      query = query.contains('feeds_scores', [dimension])
    }

    return query.order('created_at', { ascending: true }).range(range.from, range.to)
  }, supabase)
}

// =============================================================================
// Re-run Check Action
// =============================================================================

export interface RerunCheckResult {
  success: boolean
  updated: number
  passed: number
  failed: number
  warnings: number
  error?: string
}

export async function rerunCheck(
  auditId: string,
  checkName: string,
  pageUrls: string[]
): Promise<RerunCheckResult> {
  const empty = { success: false, updated: 0, passed: 0, failed: 0, warnings: 0 }

  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ...empty, error: 'Not authenticated' }

  const { data: rawRerunUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()
  const rerunMembership = (
    rawRerunUser?.team_members as { organization_id: string; role: string }[]
  )?.[0]
  const userRecord = rawRerunUser
    ? {
        organization_id: rerunMembership?.organization_id ?? null,
        role: rerunMembership?.role ?? 'client_viewer',
        is_internal: rawRerunUser.is_internal,
      }
    : null
  if (!userRecord) return { ...empty, error: 'User not found' }

  // Verify audit access
  const { data: audit } = await supabase
    .from('audits')
    .select('id, organization_id, created_by')
    .eq('id', auditId)
    .single()
  if (!audit) return { ...empty, error: 'Audit not found' }

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)
  if (!hasAccess) return { ...empty, error: 'Access denied' }

  // Look up check definition
  const checkDef = getCheckByName(checkName)
  if (!checkDef) return { ...empty, error: 'Check not found' }
  if (checkDef.isSiteWide) return { ...empty, error: 'Cannot re-run site-wide checks' }

  // Use service client for DB operations (bypasses RLS)
  const serviceClient = createServiceClient()

  const newChecks: AuditCheck[] = []
  const BATCH_SIZE = 5

  // Process pages in batches of 5
  for (let i = 0; i < pageUrls.length; i += BATCH_SIZE) {
    const batch = pageUrls.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (pageUrl) => {
        const { html, error } = await fetchPage(pageUrl)
        if (error || !html) return null

        const context: CheckContext = {
          url: pageUrl,
          html,
        }

        const result = await checkDef.run(context)
        return buildCheckRecord(auditId, pageUrl, checkDef, result)
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        newChecks.push(result.value)
      }
    }
  }

  if (newChecks.length === 0) {
    return { ...empty, error: 'No pages could be fetched' }
  }

  // Delete old check rows for these page URLs
  await serviceClient
    .from('audit_checks')
    .delete()
    .eq('audit_id', auditId)
    .eq('check_name', checkName)
    .in('page_url', pageUrls)

  // Insert new check rows
  await serviceClient.from('audit_checks').insert(newChecks)

  const passed = newChecks.filter((c) => c.status === 'passed').length
  const failed = newChecks.filter((c) => c.status === 'failed').length
  const warnings = newChecks.filter((c) => c.status === 'warning').length

  return {
    success: true,
    updated: newChecks.length,
    passed,
    failed,
    warnings,
  }
}

// =============================================================================
// Re-run Module Action
// =============================================================================

export async function rerunModule(
  auditId: string,
  dimension: ScoreDimension
): Promise<{ success: boolean; error?: string }> {
  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()
  const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = rawUser
    ? {
        organization_id: membership?.organization_id ?? null,
        role: membership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null
  if (!userRecord) return { success: false, error: 'User not found' }

  // Verify audit access
  const serviceClient = createServiceClient()
  const { data: audit } = await serviceClient
    .from('audits')
    .select('id, organization_id, created_by, url, sample_size, ai_analysis_enabled')
    .eq('id', auditId)
    .single()
  if (!audit) return { success: false, error: 'Audit not found' }

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)
  if (!hasAccess) return { success: false, error: 'Access denied' }

  // Find the module
  const mod = getModule(dimension)
  if (!mod) return { success: false, error: 'Module not found' }

  // Get all crawled pages
  const { data: pages } = await serviceClient
    .from('audit_pages')
    .select('*')
    .eq('audit_id', auditId)
  if (!pages?.length) return { success: false, error: 'No pages found for audit' }

  // Delete existing checks for this dimension
  const dimensionCheckNames = mod.checks.map((c) => c.name)
  if (dimensionCheckNames.length > 0) {
    await serviceClient
      .from('audit_checks')
      .delete()
      .eq('audit_id', auditId)
      .in('check_name', dimensionCheckNames)
  }

  // Delete existing AI analyses if re-running AI Readiness
  if (dimension === ScoreDimension.AIReadiness) {
    await serviceClient.from('audit_ai_analyses').delete().eq('audit_id', auditId)
  }

  // Re-run page-specific checks for this module
  const pageSpecific = mod.checks.filter((c) => !c.isSiteWide)
  const siteWide = mod.checks.filter((c) => c.isSiteWide)
  const newChecks: AuditCheck[] = []

  // Page-specific checks
  const htmlPages = pages.filter(
    (p: { is_resource: boolean; status_code: number | null }) =>
      !p.is_resource && (!p.status_code || p.status_code < 400)
  )

  for (const page of htmlPages) {
    try {
      const { html, error } = await fetchPage(page.url)
      if (error || !html) continue

      const context: CheckContext = {
        url: page.url,
        html,
        title: page.title ?? undefined,
        statusCode: page.status_code ?? 200,
        allPages: pages.map((p: AuditPage) => ({
          url: p.url,
          title: p.title,
          statusCode: p.status_code,
          metaDescription: p.meta_description,
          isResource: p.is_resource,
        })),
      }

      for (const check of pageSpecific) {
        try {
          const result = await check.run(context)
          newChecks.push(buildCheckRecord(auditId, page.url, check, result))
        } catch {
          // Continue on individual check failure
        }
      }
    } catch {
      // Continue on page fetch failure
    }
  }

  // Site-wide checks
  if (siteWide.length > 0 && htmlPages.length > 0) {
    const homepage =
      htmlPages.find((p: AuditPage) => {
        const pageUrl = new URL(p.url)
        return pageUrl.pathname === '/' || pageUrl.pathname === ''
      }) || htmlPages[0]

    const { html } = await fetchPage(homepage.url)
    if (html) {
      const context: CheckContext = {
        url: homepage.url,
        html,
        title: homepage.title ?? undefined,
        statusCode: homepage.status_code ?? 200,
        allPages: pages.map((p: AuditPage) => ({
          url: p.url,
          title: p.title,
          statusCode: p.status_code,
          metaDescription: p.meta_description,
          isResource: p.is_resource,
        })),
      }

      for (const check of siteWide) {
        try {
          const result = await check.run(context)
          newChecks.push(buildCheckRecord(auditId, null, check, result))
        } catch {
          // Continue
        }
      }
    }
  }

  // Insert new checks
  if (newChecks.length > 0) {
    await serviceClient.from('audit_checks').insert(newChecks)
  }

  // Run post-crawl phase and calculate score
  const postCrawlContext: PostCrawlContext = {
    auditId,
    url: audit.url,
    allPages: pages as AuditPage[],
    sampleSize: audit.sample_size ?? 5,
    organizationId: audit.organization_id,
  }

  const moduleResults = await executeModules([mod], [...newChecks], postCrawlContext)
  const moduleResult = moduleResults[0]

  // Update the dimension score and module metadata
  const scoreField =
    dimension === ScoreDimension.SEO
      ? 'seo_score'
      : dimension === ScoreDimension.Performance
        ? 'performance_score'
        : 'ai_readiness_score'

  // Get current module metadata
  const { data: currentAudit } = await serviceClient
    .from('audits')
    .select(
      'seo_score, performance_score, ai_readiness_score, module_timings, module_statuses, module_errors'
    )
    .eq('id', auditId)
    .single()

  const updatedTimings = {
    ...((currentAudit?.module_timings as Record<string, number>) ?? {}),
    [dimension]: moduleResult.durationMs,
  }
  const updatedStatuses = {
    ...((currentAudit?.module_statuses as Record<string, string>) ?? {}),
    [dimension]: moduleResult.status,
  }
  const updatedErrors = { ...((currentAudit?.module_errors as Record<string, unknown>) ?? {}) }
  if (moduleResult.error) {
    updatedErrors[dimension] = moduleResult.error
  } else {
    delete updatedErrors[dimension]
  }

  // Recalculate overall score
  const scores: Record<string, number | null> = {
    [ScoreDimension.SEO]: currentAudit?.seo_score ?? null,
    [ScoreDimension.Performance]: currentAudit?.performance_score ?? null,
    [ScoreDimension.AIReadiness]: currentAudit?.ai_readiness_score ?? null,
  }
  scores[dimension] = moduleResult.score

  const { calculateOverallScore } = await import('@/lib/unified-audit/scoring')
  const overallScore = calculateOverallScore(
    scores[ScoreDimension.SEO],
    scores[ScoreDimension.Performance],
    scores[ScoreDimension.AIReadiness]
  )

  await serviceClient
    .from('audits')
    .update({
      [scoreField]: moduleResult.score,
      overall_score: overallScore,
      module_timings: updatedTimings,
      module_statuses: updatedStatuses,
      module_errors: updatedErrors,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  revalidatePath(`/seo/audit/${auditId}`)

  return { success: true }
}
