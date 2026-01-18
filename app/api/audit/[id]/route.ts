import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: audit } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  const { data: pages } = await supabase
    .from('site_audit_pages')
    .select('*')
    .eq('audit_id', id)

  const { data: checks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', id)

  return NextResponse.json({
    audit,
    pages: pages ?? [],
    checks: checks ?? [],
  })
}
