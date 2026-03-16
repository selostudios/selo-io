import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canManageOrg, canAccessAllAudits } from '@/lib/permissions'
import { UserRole, PerformanceAuditStatus } from '@/lib/enums'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's record via team_members
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const stopMembership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userData = rawUser
    ? {
        organization_id: stopMembership?.organization_id ?? null,
        role: stopMembership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null

  const role = userData?.role

  // Check permission: canManageOrg or developer
  if (!canManageOrg(role) && role !== UserRole.Developer) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Verify the audit exists
  const { data: audit, error: fetchError } = await supabase
    .from('performance_audits')
    .select('id, status, organization_id, created_by')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify org access
  if (userData) {
    const hasAccess =
      audit.organization_id === userData.organization_id ||
      (audit.organization_id === null && audit.created_by === user.id) ||
      canAccessAllAudits(userData)

    if (!hasAccess) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }
  }

  // Only allow stopping audits that are in progress
  if (
    ![PerformanceAuditStatus.Pending, PerformanceAuditStatus.Running].includes(
      audit.status as PerformanceAuditStatus
    )
  ) {
    return NextResponse.json(
      { error: 'Audit is not in progress and cannot be stopped' },
      { status: 400 }
    )
  }

  // Use service client to bypass RLS for cleanup
  let serviceClient
  try {
    serviceClient = createServiceClient()
  } catch (err) {
    console.error('[Performance Stop Error]', {
      type: 'service_client_failed',
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Service configuration error' }, { status: 500 })
  }

  // Keep any completed results - don't delete them
  // Users should be able to see partial results if some devices finished

  // Set status to 'stopped'
  const { error: updateError } = await serviceClient
    .from('performance_audits')
    .update({
      status: PerformanceAuditStatus.Stopped,
      current_url: null,
      current_device: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('[Performance Stop Error]', {
      type: 'update_failed',
      auditId: id,
      error: updateError.message,
      code: updateError.code,
      details: updateError.details,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json(
      { error: 'Failed to stop audit', details: updateError.message, code: updateError.code },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, message: 'Audit cancelled' })
}
