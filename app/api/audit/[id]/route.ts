import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
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

  const { data: audit } = await supabase.from('site_audits').select('*').eq('id', id).single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const { data: pages } = await supabase.from('site_audit_pages').select('*').eq('audit_id', id)

  const { data: checks } = await supabase.from('site_audit_checks').select('*').eq('audit_id', id)

  return NextResponse.json({
    audit,
    pages: pages ?? [],
    checks: checks ?? [],
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .from('site_audits')
    .select('id')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Use service client to bypass RLS for deletion
  const serviceClient = createServiceClient()

  // Delete checks first (cascade should handle this, but be explicit)
  await serviceClient.from('site_audit_checks').delete().eq('audit_id', id)

  // Delete pages
  await serviceClient.from('site_audit_pages').delete().eq('audit_id', id)

  // Delete the audit
  const { error: deleteError } = await serviceClient.from('site_audits').delete().eq('id', id)

  if (deleteError) {
    console.error('[Audit Delete Error]', {
      type: 'delete_failed',
      auditId: id,
      error: deleteError.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to delete audit' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
