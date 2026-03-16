'use server'

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { canAccessAllAudits } from '@/lib/permissions'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'

export async function getPerformanceAuditData(id: string): Promise<{
  audit: PerformanceAudit
  results: PerformanceAuditResult[]
}> {
  const supabase = await createClient()

  // Get current user and their organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const psMembership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = rawUser
    ? {
        organization_id: psMembership?.organization_id ?? null,
        role: psMembership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord) {
    notFound()
  }

  const { data: audit, error: auditError } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (auditError) {
    console.error('[Performance Error]', {
      type: 'fetch_audit_by_id_failed',
      auditId: id,
      timestamp: new Date().toISOString(),
      error: auditError.message,
    })
  }

  if (!audit) {
    notFound()
  }

  // Verify organization ownership, one-time audit creator, or admin/developer access
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    console.error('[Performance Error]', {
      type: 'unauthorized_audit_access',
      auditId: id,
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  const { data: results, error: resultsError } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)
    .order('url')
    .order('device')

  if (resultsError) {
    console.error('[Performance Error]', {
      type: 'fetch_audit_results_failed',
      auditId: id,
      timestamp: new Date().toISOString(),
      error: resultsError.message,
    })
  }

  return {
    audit,
    results: results ?? [],
  }
}
