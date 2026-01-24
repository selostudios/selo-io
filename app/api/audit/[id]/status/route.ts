import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Audits stuck in crawling/checking for more than 10 minutes are considered stale
const STALE_AUDIT_THRESHOLD_MS = 10 * 60 * 1000

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let { data: audit } = await supabase.from('site_audits').select('*').eq('id', id).single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Check if audit is stale (stuck for too long) and mark as failed
  if (audit.status === 'crawling' || audit.status === 'checking') {
    const timestamp = audit.updated_at || audit.created_at
    const updatedAt = new Date(timestamp).getTime()
    const now = Date.now()
    const isStale = !isNaN(updatedAt) && (now - updatedAt > STALE_AUDIT_THRESHOLD_MS)

    if (isStale) {
      const serviceClient = createServiceClient()
      const { data: updatedAudit } = await serviceClient
        .from('site_audits')
        .update({
          status: 'failed',
          error_message: 'Audit timed out - the server function was terminated before completion. Please try again.',
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
    error_message: audit.error_message,
    started_at: audit.started_at,
    checks: checks ?? [],
  })
}
