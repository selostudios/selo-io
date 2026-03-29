'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import { notFound } from 'next/navigation'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { canAccessAllAudits } from '@/lib/permissions'
import { ScoreDimension } from '@/lib/enums'
import { fetchPage } from '@/lib/audit/fetcher'
import { getCheckByName } from '@/lib/unified-audit/checks'
import { buildCheckRecord } from '@/lib/unified-audit/runner'
import type { CheckContext } from '@/lib/unified-audit/types'
import type { UnifiedAudit, AuditCheck, AuditAIAnalysis } from '@/lib/unified-audit/types'

// =============================================================================
// Types
// =============================================================================

// Explicit column selects to avoid fetching unused data
const AUDIT_SELECT = `id, organization_id, created_by, domain, url, status,
  seo_score, performance_score, ai_readiness_score, overall_score,
  pages_crawled, crawl_mode, max_pages,
  passed_count, warning_count, failed_count,
  executive_summary, error_message,
  started_at, completed_at, created_at` as '*'

const CHECK_SELECT = `id, audit_id, page_url, category, check_name, priority, status,
  display_name, display_name_passed, description, fix_guidance,
  learn_more_url, details, feeds_scores, created_at` as '*'

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
 * Get checks filtered by score dimension tab (SEO, Performance, AI Readiness).
 * Uses the feeds_scores array to filter relevant checks.
 */
export async function getUnifiedAuditChecksByTab(
  auditId: string,
  tab: 'seo' | 'performance' | 'ai_readiness'
): Promise<AuditCheck[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const dimensionMap: Record<string, ScoreDimension> = {
    seo: ScoreDimension.SEO,
    performance: ScoreDimension.Performance,
    ai_readiness: ScoreDimension.AIReadiness,
  }

  const dimension = dimensionMap[tab]

  // Supabase supports filtering on array columns with `cs` (contains)
  const { data: checks } = await supabase
    .from('audit_checks')
    .select('*')
    .eq('audit_id', auditId)
    .contains('feeds_scores', [dimension])
    .order('created_at', { ascending: true })

  return (checks ?? []) as AuditCheck[]
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
