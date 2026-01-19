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

  const { data: audit } = await supabase.from('site_audits').select('*').eq('id', id).single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Get recent checks
  const { data: checks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    status: audit.status,
    pages_crawled: audit.pages_crawled,
    overall_score: audit.overall_score,
    seo_score: audit.seo_score,
    ai_readiness_score: audit.ai_readiness_score,
    technical_score: audit.technical_score,
    checks: checks ?? [],
  })
}
