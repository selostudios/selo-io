import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the audit exists and belongs to user's organization
  const { data: audit, error: fetchError } = await supabase
    .from('site_audits')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only allow stopping audits that are in progress
  if (!['pending', 'crawling', 'checking'].includes(audit.status)) {
    return NextResponse.json(
      { error: 'Audit is not in progress and cannot be stopped' },
      { status: 400 }
    )
  }

  // Set status to 'stopped' - the runner will detect this and finalize
  const { error: updateError } = await supabase
    .from('site_audits')
    .update({ status: 'stopped' })
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
