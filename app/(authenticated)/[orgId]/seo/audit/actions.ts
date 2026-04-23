'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord, getOrganizationsList } from '@/lib/auth/cached'
import { isInternalUser, canAccessAllAudits } from '@/lib/permissions'
import { UnifiedAuditStatus } from '@/lib/enums'
import type { AuditListBaseResult } from '@/lib/actions/audit-list-helpers'
import type { UnifiedAudit } from '@/lib/unified-audit/types'

// =============================================================================
// List Actions
// =============================================================================

export interface UnifiedAuditListResult extends AuditListBaseResult {
  audits: UnifiedAudit[]
}

const AUDIT_SELECT = `
  id, organization_id, created_by, domain, url, status,
  seo_score, performance_score, ai_readiness_score, overall_score,
  pages_crawled, crawl_mode, max_pages,
  passed_count, warning_count, failed_count,
  executive_summary, error_message,
  started_at, completed_at, created_at
`

export async function getUnifiedAuditData(
  organizationId?: string
): Promise<UnifiedAuditListResult> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) redirect('/login')

  const internal = isInternalUser(userRecord)
  const filterOrgId = internal ? organizationId || null : userRecord.organization_id

  // Build audits query
  let query = supabase
    .from('audits')
    .select(AUDIT_SELECT)
    .order('created_at', { ascending: false })
    .limit(50)

  if (filterOrgId) {
    query = query.eq('organization_id', filterOrgId)
  } else if (!internal) {
    // User without org — show only their one-time audits
    query = query.is('organization_id', null).eq('created_by', user.id)
  }

  const [{ data: audits }, organizations] = await Promise.all([query, getOrganizationsList()])

  return {
    audits: (audits ?? []) as UnifiedAudit[],
    organizations,
    isInternal: internal,
    selectedOrganizationId: filterOrgId,
  }
}

// =============================================================================
// Mutation Actions
// =============================================================================

export async function deleteUnifiedAudit(auditId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()
  if (!rawUser) return { error: 'User not found' }

  const membership = (rawUser.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = {
    is_internal: rawUser.is_internal,
    organization_id: membership?.organization_id ?? null,
    role: membership?.role ?? null,
  }

  // Fetch audit
  const { data: audit } = await supabase.from('audits').select('*').eq('id', auditId).single()
  if (!audit) return { error: 'Audit not found' }

  // Verify access
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) return { error: 'Audit not found' }

  // Only allow deleting completed, failed, or stopped audits
  const deletableStatuses = [
    UnifiedAuditStatus.Completed,
    UnifiedAuditStatus.Failed,
    UnifiedAuditStatus.Stopped,
  ]
  if (!deletableStatuses.includes(audit.status as UnifiedAuditStatus)) {
    return { error: 'Cannot delete an in-progress audit' }
  }

  // Delete checks, pages, AI analyses, then the audit itself
  await Promise.all([
    supabase.from('audit_checks').delete().eq('audit_id', auditId),
    supabase.from('audit_pages').delete().eq('audit_id', auditId),
    supabase.from('audit_ai_analyses').delete().eq('audit_id', auditId),
  ])

  const { error } = await supabase.from('audits').delete().eq('id', auditId)
  if (error) {
    console.error('[Delete Unified Audit Error]', {
      type: 'delete_failed',
      auditId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to delete audit' }
  }

  return {}
}
