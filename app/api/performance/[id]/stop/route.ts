import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageOrg } from '@/lib/permissions'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's role
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()

  const role = userData?.role

  // Check permission: canManageOrg or developer
  if (!canManageOrg(role) && role !== 'developer') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Verify the audit exists
  const { data: audit, error: fetchError } = await supabase
    .from('performance_audits')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only allow stopping audits that are in progress
  if (!['pending', 'running'].includes(audit.status)) {
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

  // Delete any partial results
  const { error: deleteError } = await serviceClient
    .from('performance_audit_results')
    .delete()
    .eq('audit_id', id)

  if (deleteError) {
    console.error('[Performance Stop Error]', {
      type: 'delete_results_failed',
      auditId: id,
      error: deleteError.message,
      timestamp: new Date().toISOString(),
    })
  }

  // Set status to 'stopped'
  const { error: updateError } = await serviceClient
    .from('performance_audits')
    .update({
      status: 'stopped',
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
