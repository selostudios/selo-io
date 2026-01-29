import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

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

  // Get audit to verify ownership
  const { data: audit, error: fetchError } = await supabase
    .from('aio_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify access: allow if user owns it (same org or created it), or if internal/admin/developer
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) || // One-time audits: only creator
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check if any reports use this audit
  const serviceClient = createServiceClient()
  const { count: reportCount } = await serviceClient
    .from('generated_reports')
    .select('*', { count: 'exact', head: true })
    .eq('aio_audit_id', id)

  // If reports exist and force is not set, return warning
  if (reportCount && reportCount > 0 && !force) {
    return NextResponse.json(
      {
        error: 'Audit is used in reports',
        reportCount,
        message: `This audit is used in ${reportCount} report${reportCount > 1 ? 's' : ''}. Deleting it will also delete those reports.`,
      },
      { status: 409 }
    )
  }

  // Delete audit (cascade will handle checks and AI analyses)
  const { error: deleteError } = await supabase.from('aio_audits').delete().eq('id', id)

  if (deleteError) {
    console.error('[AIO API] Failed to delete audit:', deleteError)
    return NextResponse.json({ error: 'Failed to delete audit' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
