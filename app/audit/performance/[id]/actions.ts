'use server'

import { createClient } from '@/lib/supabase/server'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'

export async function getPerformanceAuditData(id: string): Promise<{
  audit: PerformanceAudit | null
  results: PerformanceAuditResult[]
}> {
  const supabase = await createClient()

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
