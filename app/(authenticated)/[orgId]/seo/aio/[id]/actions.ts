import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import type { AIOAudit, AIOCheck, AIOAIAnalysis } from '@/lib/aio/types'

export async function getAIOAuditReport(auditId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization, internal status, and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    throw new Error('User not found')
  }

  // Fetch audit
  const { data: audit, error: auditError } = await supabase
    .from('aio_audits')
    .select('*')
    .eq('id', auditId)
    .single()

  if (auditError || !audit) {
    throw new Error('Audit not found')
  }

  // Verify access: allow if user owns it (same org or created it), or if internal/admin/developer
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) || // One-time audits: only creator
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    throw new Error('Audit not found')
  }

  // Fetch checks
  const { data: checks } = await supabase
    .from('aio_checks')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: true })

  // Fetch AI analyses
  const { data: aiAnalyses } = await supabase
    .from('aio_ai_analyses')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: true })

  return {
    audit: audit as AIOAudit,
    checks: (checks ?? []) as AIOCheck[],
    aiAnalyses: (aiAnalyses ?? []) as AIOAIAnalysis[],
  }
}
