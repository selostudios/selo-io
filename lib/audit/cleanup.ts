import { createServiceClient } from '@/lib/supabase/server'

/**
 * Delete checks and pages from older audits, keeping only the most recent audit's details.
 * This preserves score history while reducing database size by ~90%.
 *
 * For organization audits: keeps only the latest audit's checks/pages per organization
 * For one-time audits: keeps only the latest audit's checks/pages per URL
 */
export async function cleanupOlderAuditDetails(
  currentAuditId: string,
  organizationId: string | null,
  url: string
): Promise<{ deletedChecks: number; deletedPages: number }> {
  const supabase = createServiceClient()

  let olderAuditIds: string[] = []

  if (organizationId) {
    // For organization audits: find older completed audits for this organization
    const { data: olderAudits } = await supabase
      .from('site_audits')
      .select('id')
      .eq('organization_id', organizationId)
      .neq('id', currentAuditId)
      .in('status', ['completed', 'stopped'])

    olderAuditIds = olderAudits?.map((a) => a.id) ?? []
  } else {
    // For one-time audits: find older completed audits for this exact URL
    // (one-time audits have no organization, so we match by URL)
    const baseUrl = new URL(url).origin
    const { data: olderAudits } = await supabase
      .from('site_audits')
      .select('id, url')
      .is('organization_id', null)
      .neq('id', currentAuditId)
      .in('status', ['completed', 'stopped'])

    // Filter to same base URL (domain)
    olderAuditIds =
      olderAudits?.filter((a) => {
        try {
          return new URL(a.url).origin === baseUrl
        } catch {
          return false
        }
      }).map((a) => a.id) ?? []
  }

  if (olderAuditIds.length === 0) {
    return { deletedChecks: 0, deletedPages: 0 }
  }

  console.log(
    `[Audit Cleanup] Cleaning up ${olderAuditIds.length} older audits for ${organizationId ? `org ${organizationId}` : `URL ${url}`}`
  )

  // Delete checks from older audits
  const { count: deletedChecks } = await supabase
    .from('site_audit_checks')
    .delete({ count: 'exact' })
    .in('audit_id', olderAuditIds)

  // Delete pages from older audits
  const { count: deletedPages } = await supabase
    .from('site_audit_pages')
    .delete({ count: 'exact' })
    .in('audit_id', olderAuditIds)

  // Delete crawl queue entries from older audits
  await supabase.from('site_audit_crawl_queue').delete().in('audit_id', olderAuditIds)

  console.log(
    `[Audit Cleanup] Deleted ${deletedChecks ?? 0} checks and ${deletedPages ?? 0} pages from older audits`
  )

  return {
    deletedChecks: deletedChecks ?? 0,
    deletedPages: deletedPages ?? 0,
  }
}

/**
 * Cleanup crawl queue for a completed audit.
 * The queue is no longer needed after the audit finishes.
 */
export async function cleanupCrawlQueue(auditId: string): Promise<number> {
  const supabase = createServiceClient()

  const { count } = await supabase
    .from('site_audit_crawl_queue')
    .delete({ count: 'exact' })
    .eq('audit_id', auditId)

  if (count && count > 0) {
    console.log(`[Audit Cleanup] Deleted ${count} crawl queue entries for audit ${auditId}`)
  }

  return count ?? 0
}

/**
 * Periodic cleanup job to catch any orphaned data.
 * - Deletes checks/pages from audits older than 6 months
 * - Deletes one-time audits (with no organization) older than 30 days entirely
 * - Cleans up orphaned crawl queue entries
 */
export async function runPeriodicCleanup(): Promise<{
  deletedChecks: number
  deletedPages: number
  deletedAudits: number
  deletedQueueEntries: number
}> {
  const supabase = createServiceClient()

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  console.log('[Audit Cleanup] Starting periodic cleanup...')

  // 1. Delete checks/pages from audits older than 6 months (keep audit record for history)
  const { data: oldAudits } = await supabase
    .from('site_audits')
    .select('id')
    .lt('completed_at', sixMonthsAgo.toISOString())
    .in('status', ['completed', 'stopped'])

  const oldAuditIds = oldAudits?.map((a) => a.id) ?? []

  let deletedChecks = 0
  let deletedPages = 0

  if (oldAuditIds.length > 0) {
    const { count: checks } = await supabase
      .from('site_audit_checks')
      .delete({ count: 'exact' })
      .in('audit_id', oldAuditIds)

    const { count: pages } = await supabase
      .from('site_audit_pages')
      .delete({ count: 'exact' })
      .in('audit_id', oldAuditIds)

    deletedChecks = checks ?? 0
    deletedPages = pages ?? 0
  }

  // 2. Delete one-time audits older than 30 days entirely (including the audit record)
  const { data: oldOneTimeAudits } = await supabase
    .from('site_audits')
    .select('id')
    .is('organization_id', null)
    .lt('completed_at', thirtyDaysAgo.toISOString())
    .in('status', ['completed', 'stopped', 'failed'])

  let deletedAudits = 0
  if (oldOneTimeAudits && oldOneTimeAudits.length > 0) {
    // Cascade will handle checks/pages deletion
    const { count } = await supabase
      .from('site_audits')
      .delete({ count: 'exact' })
      .in(
        'id',
        oldOneTimeAudits.map((a) => a.id)
      )

    deletedAudits = count ?? 0
  }

  // 3. Clean up orphaned crawl queue entries (from failed/stuck audits)
  const { count: deletedQueueEntries } = await supabase
    .from('site_audit_crawl_queue')
    .delete({ count: 'exact' })
    .lt('discovered_at', thirtyDaysAgo.toISOString())

  console.log(
    `[Audit Cleanup] Periodic cleanup complete: ${deletedChecks} checks, ${deletedPages} pages, ${deletedAudits} one-time audits, ${deletedQueueEntries ?? 0} queue entries`
  )

  return {
    deletedChecks,
    deletedPages,
    deletedAudits,
    deletedQueueEntries: deletedQueueEntries ?? 0,
  }
}
