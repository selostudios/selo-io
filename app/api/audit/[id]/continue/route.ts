import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAuditBatch } from '@/lib/audit/runner'

// Extend function timeout for batch processing (max 300s on Pro plan)
export const maxDuration = 300

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: auditId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get audit and verify status
  const { data: audit, error } = await supabase
    .from('site_audits')
    .select('id, url, status, current_batch')
    .eq('id', auditId)
    .single()

  if (error || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only continue if status is batch_complete
  if (audit.status !== 'batch_complete') {
    return NextResponse.json(
      { error: `Cannot continue audit in ${audit.status} status` },
      { status: 400 }
    )
  }

  // Run next batch in background
  after(async () => {
    try {
      await runAuditBatch(auditId, audit.url)
    } catch (err) {
      console.error('[Audit Continue] Background batch failed:', err)
    }
  })

  return NextResponse.json({
    success: true,
    batch: (audit.current_batch || 0) + 1,
  })
}
