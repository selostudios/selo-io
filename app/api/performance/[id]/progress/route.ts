import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'

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

  // Get count of completed results
  const { count: resultsCount } = await supabase
    .from('performance_audit_results')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', id)

  return NextResponse.json({
    ...audit,
    results_count: resultsCount ?? 0,
  })
}
