import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get audit with progress info
  const { data: audit, error } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('id', id)
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (error || !audit) {
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
