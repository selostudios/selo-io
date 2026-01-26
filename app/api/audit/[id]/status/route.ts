import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { runAuditBatch } from '@/lib/audit/runner'

// Audits stuck in crawling/checking for more than 15 minutes are considered stale
// (Vercel function timeout is 800 seconds / ~13 minutes, so 15 minutes catches timeouts)
const STALE_AUDIT_THRESHOLD_MS = 15 * 60 * 1000

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Use getSession() instead of getUser() to avoid rate limits
  // This endpoint is polled every 2 seconds during active audits
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let { data: audit } = await supabase.from('site_audits').select('*').eq('id', id).single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Check if audit is stale (stuck for too long)
  if (
    audit.status === 'crawling' ||
    audit.status === 'checking' ||
    audit.status === 'batch_complete'
  ) {
    const timestamp = audit.updated_at || audit.created_at
    const updatedAt = new Date(timestamp).getTime()
    const now = Date.now()
    const isStale = !isNaN(updatedAt) && now - updatedAt > STALE_AUDIT_THRESHOLD_MS

    if (isStale) {
      const serviceClient = createServiceClient()

      if (audit.status === 'batch_complete') {
        // For stale batch_complete, auto-resume the audit
        // This handles cases where client disconnected before triggering continue
        console.log('[Audit Status] Auto-resuming stale batch_complete audit', {
          auditId: id,
          timestamp: new Date().toISOString(),
        })

        after(async () => {
          try {
            await runAuditBatch(id, audit.url)
          } catch (err) {
            console.error('[Audit Status] Auto-resume failed:', err)
          }
        })

        // Return current status - next poll will see 'crawling'
      } else {
        // For crawling/checking, mark as failed (timeout)
        const { data: updatedAudit } = await serviceClient
          .from('site_audits')
          .update({
            status: 'failed',
            error_message:
              'Audit timed out - the server function was terminated before completion. Please try again.',
            completed_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single()

        if (updatedAudit) {
          audit = updatedAudit
        }

        console.log('[Audit Status] Marked stale audit as failed', {
          auditId: id,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  // Get recent checks
  const { data: checks } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Get remaining URLs in queue for batch progress
  const { count: urlsRemaining } = await supabase
    .from('site_audit_crawl_queue')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', id)
    .is('crawled_at', null)

  return NextResponse.json({
    status: audit.status,
    url: audit.url,
    pages_crawled: audit.pages_crawled,
    overall_score: audit.overall_score,
    seo_score: audit.seo_score,
    ai_readiness_score: audit.ai_readiness_score,
    technical_score: audit.technical_score,
    error_message: audit.error_message,
    started_at: audit.started_at,
    checks: checks ?? [],
    current_batch: audit.current_batch ?? 0,
    urls_discovered: audit.urls_discovered ?? 0,
    urls_remaining: urlsRemaining ?? 0,
  })
}
