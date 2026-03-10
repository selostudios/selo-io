import { createServiceClient } from '@/lib/supabase/server'
import { UnifiedAuditStatus } from '@/lib/enums'

/**
 * Delete checks and pages from older unified audits, keeping only the most recent audit's details.
 * This preserves score history while reducing database size.
 *
 * For organization audits: keeps only the latest audit's checks/pages per organization
 * For one-time audits: keeps only the latest audit's checks/pages per URL
 */
export async function cleanupOlderUnifiedAuditDetails(
  currentAuditId: string,
  organizationId: string | null,
  url: string
): Promise<{ deletedChecks: number; deletedPages: number }> {
  const supabase = createServiceClient()

  let olderAuditIds: string[] = []

  if (organizationId) {
    const { data: olderAudits } = await supabase
      .from('audits')
      .select('id')
      .eq('organization_id', organizationId)
      .neq('id', currentAuditId)
      .in('status', [UnifiedAuditStatus.Completed, UnifiedAuditStatus.Stopped])

    olderAuditIds = olderAudits?.map((a) => a.id) ?? []
  } else {
    const baseUrl = new URL(url).origin
    const { data: olderAudits } = await supabase
      .from('audits')
      .select('id, url')
      .is('organization_id', null)
      .neq('id', currentAuditId)
      .in('status', [UnifiedAuditStatus.Completed, UnifiedAuditStatus.Stopped])

    olderAuditIds =
      olderAudits
        ?.filter((a) => {
          try {
            return new URL(a.url).origin === baseUrl
          } catch {
            return false
          }
        })
        .map((a) => a.id) ?? []
  }

  if (olderAuditIds.length === 0) {
    return { deletedChecks: 0, deletedPages: 0 }
  }

  console.log(
    `[Unified Audit Cleanup] Cleaning up ${olderAuditIds.length} older audits for ${organizationId ? `org ${organizationId}` : `URL ${url}`}`
  )

  const { count: deletedChecks } = await supabase
    .from('audit_checks')
    .delete({ count: 'exact' })
    .in('audit_id', olderAuditIds)

  const { count: deletedPages } = await supabase
    .from('audit_pages')
    .delete({ count: 'exact' })
    .in('audit_id', olderAuditIds)

  console.log(
    `[Unified Audit Cleanup] Deleted ${deletedChecks ?? 0} checks and ${deletedPages ?? 0} pages from older audits`
  )

  return {
    deletedChecks: deletedChecks ?? 0,
    deletedPages: deletedPages ?? 0,
  }
}

/**
 * Periodic cleanup for unified audit data.
 * - Deletes checks/pages from audits older than 6 months (keeps audit record for trend history)
 * - Deletes one-time audits (no organization) older than 30 days entirely
 */
export async function runUnifiedAuditCleanup(): Promise<{
  deletedChecks: number
  deletedPages: number
  deletedAudits: number
}> {
  const supabase = createServiceClient()

  console.log('[Unified Audit Cleanup] Starting periodic cleanup...')

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const sixMonthsAgoISO = sixMonthsAgo.toISOString()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoISO = thirtyDaysAgo.toISOString()

  // 1. Delete checks/pages from audits older than 6 months
  const { data: oldAudits } = await supabase
    .from('audits')
    .select('id')
    .lt('created_at', sixMonthsAgoISO)
    .in('status', [UnifiedAuditStatus.Completed, UnifiedAuditStatus.Stopped])

  const oldAuditIds = oldAudits?.map((a) => a.id) ?? []
  let deletedChecks = 0
  let deletedPages = 0

  if (oldAuditIds.length > 0) {
    const { count: checksDeleted } = await supabase
      .from('audit_checks')
      .delete({ count: 'exact' })
      .in('audit_id', oldAuditIds)

    const { count: pagesDeleted } = await supabase
      .from('audit_pages')
      .delete({ count: 'exact' })
      .in('audit_id', oldAuditIds)

    deletedChecks = checksDeleted ?? 0
    deletedPages = pagesDeleted ?? 0
  }

  // 2. Delete one-time audits older than 30 days entirely
  const { count: deletedAudits } = await supabase
    .from('audits')
    .delete({ count: 'exact' })
    .is('organization_id', null)
    .lt('created_at', thirtyDaysAgoISO)

  console.log(
    `[Unified Audit Cleanup] Periodic cleanup complete: ${deletedChecks} checks, ${deletedPages} pages, ${deletedAudits ?? 0} one-time audits`
  )

  return {
    deletedChecks,
    deletedPages,
    deletedAudits: deletedAudits ?? 0,
  }
}
