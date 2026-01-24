'use server'

import { createClient } from '@/lib/supabase/server'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'

export async function getPerformanceAuditData(id: string): Promise<{
  audit: PerformanceAudit | null
  results: PerformanceAuditResult[]
}> {
  const supabase = await createClient()

  // Get current user and their organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { audit: null, results: [] }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { audit: null, results: [] }
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
    return { audit: null, results: [] }
  }

  // Verify organization ownership to prevent IDOR
  if (audit.organization_id !== userRecord.organization_id) {
    console.error('[Performance Error]', {
      type: 'unauthorized_audit_access',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    return { audit: null, results: [] }
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
