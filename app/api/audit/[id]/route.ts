import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canManageOrg, canAccessAllAudits } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: audit } = await supabase.from('site_audits').select('*').eq('id', id).single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
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
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's record
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()
  const role = userData?.role

  // Check permission: canManageOrg or developer
  if (!canManageOrg(role) && role !== UserRole.Developer) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // Verify the audit exists
  const { data: audit, error: fetchError } = await supabase
    .from('site_audits')
    .select('id, organization_id, created_by')
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

  // Check if any reports use this audit
  const serviceClient = createServiceClient()
  const { count: reportCount } = await serviceClient
    .from('generated_reports')
    .select('*', { count: 'exact', head: true })
    .eq('site_audit_id', id)

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

  // Delete checks first (cascade should handle this, but be explicit)
  await serviceClient.from('site_audit_checks').delete().eq('audit_id', id)

  // Delete pages
  await serviceClient.from('site_audit_pages').delete().eq('audit_id', id)

  // Delete the audit (this will cascade delete reports due to FK)
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
