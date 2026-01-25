import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resumeAuditChecks, completeAuditWithExistingChecks } from '@/lib/audit/runner'

// Extend function timeout for long-running audits (Vercel config set to 800s)
export const maxDuration = 800

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
    .select('id, status, url, pages_crawled')
    .eq('id', id)
    .single()

  if (fetchError || !audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only allow resuming failed or stopped audits that have pages
  if (!['failed', 'stopped'].includes(audit.status)) {
    return NextResponse.json(
      { error: 'Only failed or stopped audits can be resumed' },
      { status: 400 }
    )
  }

  if (!audit.pages_crawled || audit.pages_crawled === 0) {
    return NextResponse.json(
      { error: 'No pages were crawled - nothing to analyze' },
      { status: 400 }
    )
  }

  // Check if there are already checks
  const { count: checksCount } = await supabase
    .from('site_audit_checks')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', id)

  const hasExistingChecks = checksCount && checksCount > 0

  // Update status to checking
  const serviceClient = createServiceClient()
  await serviceClient
    .from('site_audits')
    .update({
      status: 'checking',
      error_message: null,
      completed_at: null,
    })
    .eq('id', id)

  // Start checks in background
  after(async () => {
    try {
      if (hasExistingChecks) {
        // Just run site-wide checks and calculate scores from existing checks
        await completeAuditWithExistingChecks(id, audit.url)
      } else {
        // Run all checks from scratch
        await resumeAuditChecks(id, audit.url)
      }
    } catch (err) {
      console.error('[Audit Resume Error] Background checks failed:', err)
    }
  })

  return NextResponse.json({ success: true, message: 'Audit checks resumed' })
}
