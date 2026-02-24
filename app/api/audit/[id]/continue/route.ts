import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runAuditBatch } from '@/lib/audit/runner'

// Extend function timeout for batch processing (800s on Vercel Pro plan)
export const maxDuration = 800

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: auditId } = await params

  // Accept either user auth or internal service call via CRON_SECRET
  const cronSecret = request.headers.get('x-cron-secret')
  const isInternalCall = cronSecret === process.env.CRON_SECRET && !!cronSecret

  if (!isInternalCall) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Use service client for audit query (works for both user and internal calls)
  const supabase = createServiceClient()

  // Atomically claim the continuation to prevent duplicate batch runs
  // (both browser polling and server self-trigger may hit this endpoint simultaneously)
  const { data: claimed } = await supabase
    .from('site_audits')
    .update({ status: 'crawling', updated_at: new Date().toISOString() })
    .eq('id', auditId)
    .eq('status', 'batch_complete')
    .select('id, url, current_batch')
    .single()

  if (!claimed) {
    return NextResponse.json({ error: 'Audit not available for continuation' }, { status: 409 })
  }

  // Run next batch in background
  after(async () => {
    try {
      await runAuditBatch(auditId, claimed.url)
    } catch (err) {
      console.error('[Audit Continue] Background batch failed:', err)
    }
  })

  return NextResponse.json({
    success: true,
    batch: (claimed.current_batch || 0) + 1,
  })
}
