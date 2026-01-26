import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import type { GEOAudit, GEOCheck, GEOAIAnalysis } from '@/lib/geo/types'

export async function getGEOAuditReport(auditId: string) {
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
    .from('geo_audits')
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
    .from('geo_checks')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: true })

  // Fetch AI analyses
  const { data: aiAnalyses } = await supabase
    .from('geo_ai_analyses')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: true })

  return {
    audit: audit as GEOAudit,
    checks: (checks ?? []) as GEOCheck[],
    aiAnalyses: (aiAnalyses ?? []) as GEOAIAnalysis[],
  }
}
