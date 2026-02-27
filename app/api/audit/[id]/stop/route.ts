import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import { AuditStatus } from '@/lib/enums'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  // Verify the audit exists
  const { data: audit, error: fetchError } = await supabase
    .from('site_audits')
    .select('id, status, updated_at, created_at, organization_id, created_by')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify org access
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only allow stopping audits that are in progress
  if (
    ![AuditStatus.Pending, AuditStatus.Crawling, AuditStatus.Checking].includes(
      audit.status as AuditStatus
    )
  ) {
    return NextResponse.json(
      { error: 'Audit is not in progress and cannot be stopped' },
      { status: 400 }
    )
  }

  // Check if the audit has been stuck (no updates for over 5 minutes = runner is dead)
  const timestamp = audit.updated_at || audit.created_at
  const lastUpdate = timestamp ? new Date(timestamp).getTime() : 0
  const isStuck = Date.now() - lastUpdate > 5 * 60 * 1000

  if (isStuck) {
    // Runner is dead, mark as failed immediately
    const { error: updateError } = await supabase
      .from('site_audits')
      .update({
        status: AuditStatus.Failed,
        error_message: 'Audit was stopped - the crawl did not complete.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Audit Stop Error]', {
        type: 'update_failed',
        auditId: id,
        error: updateError.message,
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json({ error: 'Failed to stop audit' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Audit marked as failed (runner was not responding)',
    })
  }

  // Runner might still be alive, set status to 'stopped' for it to detect
  const { error: updateError } = await supabase
    .from('site_audits')
    .update({ status: AuditStatus.Stopped })
    .eq('id', id)

  if (updateError) {
    console.error('[Audit Stop Error]', {
      type: 'update_failed',
      auditId: id,
      error: updateError.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to stop audit' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Audit stop requested' })
}
