import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  //Use getUser() to securely validate the session with the Auth server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization, internal status, and role via team_members
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = rawUser
    ? {
        organization_id: membership?.organization_id ?? null,
        role: membership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get audit
  const { data: audit, error } = await supabase.from('aio_audits').select('*').eq('id', id).single()

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

  // Get checks
  const { data: checks } = await supabase
    .from('aio_checks')
    .select('*')
    .eq('audit_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    audit,
    checks: checks ?? [],
  })
}
