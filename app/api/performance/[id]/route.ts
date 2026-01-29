import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageOrg } from '@/lib/permissions'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get audit with results
  const { data: audit, error: auditError } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (auditError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Get results
  const { data: results } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', id)
    .order('url')
    .order('device')

  return NextResponse.json({
    audit,
    results: results || [],
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

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
    .select('id')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Use service client to bypass RLS for deletion
  const serviceClient = createServiceClient()

  // Check if any reports use this audit
  const { count: reportCount } = await serviceClient
    .from('generated_reports')
    .select('*', { count: 'exact', head: true })
    .eq('performance_audit_id', id)

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

  // Delete results first (cascade should handle this, but be explicit)
  await serviceClient.from('performance_audit_results').delete().eq('audit_id', id)

  // Delete the audit
  const { error: deleteError } = await serviceClient
    .from('performance_audits')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[Performance Delete Error]', {
      type: 'delete_failed',
      auditId: id,
      error: deleteError.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to delete audit' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
