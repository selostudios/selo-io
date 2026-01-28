import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import { PerformanceAuditStatus } from '@/lib/enums'

// Mark audits as timed out if running for more than 3 minutes
const STALE_AUDIT_TIMEOUT_MS = 3 * 60 * 1000

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Use getUser() to securely validate the session with the Auth server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization, internal status, and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get audit with progress info (no organization filter yet)
  const { data: audit, error } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify access: allow if user owns it (same org or created it), or if internal/admin/developer
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) || // One-time audits: only creator
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Check for stale running audits and mark them as completed with partial results
  if (
    audit.status === PerformanceAuditStatus.Running &&
    audit.started_at
  ) {
    const startedAt = new Date(audit.started_at).getTime()
    const now = Date.now()
    const elapsed = now - startedAt

    if (elapsed > STALE_AUDIT_TIMEOUT_MS) {
      console.log('[Performance] Marking stale audit as completed:', {
        auditId: id,
        elapsedMs: elapsed,
        startedAt: audit.started_at,
      })

      // Use service client to update (bypass RLS)
      const serviceClient = createServiceClient()
      await serviceClient
        .from('performance_audits')
        .update({
          status: PerformanceAuditStatus.Completed,
          error_message: 'Audit timed out - partial results may be available',
          completed_at: new Date().toISOString(),
          current_url: null,
        })
        .eq('id', id)

      // Update local audit object for response
      audit.status = PerformanceAuditStatus.Completed
      audit.error_message = 'Audit timed out - partial results may be available'
      audit.completed_at = new Date().toISOString()
    }
  }

  // Get count of completed results (total and per-device)
  const [totalCountResult, mobileCountResult, desktopCountResult] = await Promise.all([
    supabase
      .from('performance_audit_results')
      .select('*', { count: 'exact', head: true })
      .eq('audit_id', id),
    supabase
      .from('performance_audit_results')
      .select('*', { count: 'exact', head: true })
      .eq('audit_id', id)
      .eq('device', 'mobile'),
    supabase
      .from('performance_audit_results')
      .select('*', { count: 'exact', head: true })
      .eq('audit_id', id)
      .eq('device', 'desktop'),
  ])

  return NextResponse.json({
    ...audit,
    results_count: totalCountResult.count ?? 0,
    mobile_results_count: mobileCountResult.count ?? 0,
    desktop_results_count: desktopCountResult.count ?? 0,
  })
}
