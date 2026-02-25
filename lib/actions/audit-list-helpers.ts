import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getAuthUser, getUserRecord, getOrganizationsList } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit } from '@/lib/performance/types'
import type { GeneratedReport } from '@/lib/reports/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================
// Base Types
// ============================================================

/**
 * Base result shared by all audit list data functions
 */
export interface AuditListBaseResult {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

/**
 * Context passed to custom query builders
 */
export interface AuditListContext {
  supabase: SupabaseClient
  filterOrgId: string | null
  isInternal: boolean
  userId: string
}

// ============================================================
// Organization Selector Helper
// ============================================================

/**
 * Get organizations formatted for selector component.
 * Delegates to cached helper to avoid redundant queries within the same request.
 */
export async function getOrganizationsForSelector(): Promise<OrganizationForSelector[]> {
  return getOrganizationsList()
}

// ============================================================
// Cached Auth Helper
// ============================================================

async function getCachedCurrentUser() {
  const user = await getAuthUser()
  if (!user) return null
  const record = await getUserRecord(user.id)
  if (!record) return null
  return {
    id: record.id,
    isInternal: isInternalUser(record),
    organizationId: record.organization_id,
  }
}

// ============================================================
// Generic Audit List Helper
// ============================================================

/**
 * Generic helper for fetching audit list data with organization filtering
 *
 * @example
 * ```ts
 * const data = await getAuditListData({
 *   organizationId,
 *   buildQuery: async (ctx) => {
 *     let query = ctx.supabase.from('my_audits').select('*')
 *     if (ctx.filterOrgId) query = query.eq('organization_id', ctx.filterOrgId)
 *     const { data } = await query
 *     return data ?? []
 *   }
 * })
 * ```
 */
export async function getAuditListData<T>(options: {
  organizationId?: string
  buildQuery: (ctx: AuditListContext) => Promise<T[]>
}): Promise<AuditListBaseResult & { audits: T[] }> {
  const supabase = await createClient()
  const currentUser = await getCachedCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId, id: userId } = currentUser

  // Determine the filter organization:
  // - For internal users: use provided org or null (see all)
  // - For external users: always use their own org
  const filterOrgId = isInternal ? options.organizationId || null : userOrgId

  const ctx: AuditListContext = {
    supabase,
    filterOrgId,
    isInternal,
    userId,
  }

  const [audits, organizations] = await Promise.all([
    options.buildQuery(ctx),
    getOrganizationsForSelector(),
  ])

  return {
    audits,
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}

// ============================================================
// Site Audit List Helper
// ============================================================

export interface SiteAuditListResult extends AuditListBaseResult {
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
}

const SITE_AUDIT_SELECT = `
  id, organization_id, created_by, url, status, overall_score, seo_score,
  ai_readiness_score, technical_score, pages_crawled, failed_count,
  warning_count, passed_count, executive_summary, error_message,
  archived_at, started_at, completed_at, created_at
`

/**
 * Get site audit list data including archived audits
 */
export async function getSiteAuditListData(organizationId?: string): Promise<SiteAuditListResult> {
  const supabase = await createClient()
  const currentUser = await getCachedCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser
  const filterOrgId = isInternal ? organizationId || null : userOrgId

  // Build audits query
  let auditsQuery = supabase
    .from('site_audits')
    .select(SITE_AUDIT_SELECT)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    auditsQuery = auditsQuery.eq('organization_id', filterOrgId)
  }

  // Build archived audits query
  let archivedQuery = supabase
    .from('site_audits')
    .select(SITE_AUDIT_SELECT)
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    archivedQuery = archivedQuery.eq('organization_id', filterOrgId)
  }

  // Execute queries in parallel
  const [auditsResult, archivedResult, organizations] = await Promise.all([
    auditsQuery,
    archivedQuery,
    getOrganizationsForSelector(),
  ])

  return {
    audits: (auditsResult.data ?? []) as SiteAudit[],
    archivedAudits: (archivedResult.data ?? []) as SiteAudit[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}

// ============================================================
// Performance Audit List Helper
// ============================================================

export interface PerformanceAuditListResult extends AuditListBaseResult {
  audits: PerformanceAudit[]
}

const PERFORMANCE_AUDIT_SELECT = `
  id, organization_id, created_by, status, error_message, started_at,
  completed_at, created_at, current_url, current_device, total_urls, completed_count
`

/**
 * Get performance audit list data with URL enrichment for one-time audits
 */
export async function getPerformanceAuditListData(
  organizationId?: string
): Promise<PerformanceAuditListResult> {
  const supabase = await createClient()
  const currentUser = await getCachedCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser
  const filterOrgId = isInternal ? organizationId || null : userOrgId

  // Build audits query
  let auditsQuery = supabase
    .from('performance_audits')
    .select(PERFORMANCE_AUDIT_SELECT)
    .order('created_at', { ascending: false })
    .limit(20)

  if (filterOrgId) {
    auditsQuery = auditsQuery.eq('organization_id', filterOrgId)
  }

  const { data: audits, error: auditsError } = await auditsQuery

  if (auditsError) {
    console.error('[Performance Error]', {
      type: 'fetch_audits_failed',
      timestamp: new Date().toISOString(),
      error: auditsError.message,
    })
  }

  // For one-time audits (organization_id = null), fetch the first URL from results
  const oneTimeAuditIds = (audits ?? [])
    .filter((audit) => audit.organization_id === null)
    .map((audit) => audit.id)

  let firstUrlsMap: Record<string, string> = {}

  if (oneTimeAuditIds.length > 0) {
    const { data: firstUrls } = await supabase
      .from('performance_audit_results')
      .select('audit_id, url')
      .in('audit_id', oneTimeAuditIds)
      .order('created_at', { ascending: true })

    if (firstUrls) {
      firstUrlsMap = firstUrls.reduce(
        (acc, result) => {
          if (!acc[result.audit_id]) {
            acc[result.audit_id] = result.url
          }
          return acc
        },
        {} as Record<string, string>
      )
    }
  }

  // Fetch average performance scores for completed audits
  const completedAuditIds = (audits ?? [])
    .filter((audit) => audit.status === 'completed')
    .map((audit) => audit.id)

  const avgScoresMap: Record<string, number> = {}

  if (completedAuditIds.length > 0) {
    const { data: results } = await supabase
      .from('performance_audit_results')
      .select('audit_id, performance_score')
      .in('audit_id', completedAuditIds)
      .not('performance_score', 'is', null)

    if (results) {
      // Group scores by audit_id and compute average
      const scoresByAudit: Record<string, number[]> = {}
      for (const result of results) {
        if (!scoresByAudit[result.audit_id]) {
          scoresByAudit[result.audit_id] = []
        }
        scoresByAudit[result.audit_id].push(result.performance_score as number)
      }
      for (const [auditId, scores] of Object.entries(scoresByAudit)) {
        avgScoresMap[auditId] = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      }
    }
  }

  // Add first_url and avg_performance_score to audits
  const enrichedAudits = (audits ?? []).map((audit) => ({
    ...audit,
    ...(audit.organization_id === null && firstUrlsMap[audit.id]
      ? { first_url: firstUrlsMap[audit.id] }
      : {}),
    avg_performance_score: avgScoresMap[audit.id] ?? null,
  }))

  const organizations = await getOrganizationsForSelector()

  return {
    audits: enrichedAudits as PerformanceAudit[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}

// ============================================================
// Reports List Helper
// ============================================================

export interface ReportsListResult extends AuditListBaseResult {
  reports: GeneratedReport[]
}

/**
 * Get reports list data
 */
export async function getReportsListData(organizationId?: string): Promise<ReportsListResult> {
  const supabase = await createClient()
  const currentUser = await getCachedCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser
  const filterOrgId = isInternal ? organizationId || null : userOrgId

  // Build reports query
  let reportsQuery = supabase
    .from('generated_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    reportsQuery = reportsQuery.eq('organization_id', filterOrgId)
  }

  const [reportsResult, organizations] = await Promise.all([
    reportsQuery,
    getOrganizationsForSelector(),
  ])

  if (reportsResult.error) {
    console.error('[Get Reports Error]', {
      type: 'reports_fetch_failed',
      error: reportsResult.error.message,
      timestamp: new Date().toISOString(),
    })
  }

  return {
    reports: (reportsResult.data ?? []) as GeneratedReport[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}
