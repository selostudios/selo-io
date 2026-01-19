'use server'

import { createClient } from '@/lib/supabase/server'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'

export async function getPerformanceAuditData(id: string): Promise<{
  audit: PerformanceAudit | null
  results: PerformanceAuditResult[]
}> {
  const supabase = await createClient()

  const { data: audit } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (!audit) {
    return { audit: null, results: [] }
  }

  const { data: results } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)
    .order('url')
    .order('device')

  return {
    audit,
    results: results || [],
  }
}
