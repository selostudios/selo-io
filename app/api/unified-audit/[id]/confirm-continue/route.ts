import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAllAudits, canAccessOrg } from '@/lib/permissions'
import { runUnifiedAuditBatch } from '@/lib/unified-audit/runner'

// Extend function timeout for continued crawling
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

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const memberships = (rawUser?.team_members as { organization_id: string; role: string }[]) ?? []
  const userRecord = rawUser
    ? {
        memberships,
        role: memberships[0]?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Fetch audit
  const { data: audit } = await supabase
    .from('audits')
    .select('id, url, status, organization_id, created_by, max_pages')
    .eq('id', id)
    .single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify access
  const hasAccess =
    (audit.organization_id && canAccessOrg(userRecord, audit.organization_id)) ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Only allow confirming audits in awaiting_confirmation status
  if (audit.status !== 'awaiting_confirmation') {
    return NextResponse.json({ error: 'Audit is not awaiting confirmation' }, { status: 400 })
  }

  // Parse optional new max_pages from request
  let newMaxPages = audit.max_pages * 2 // Double by default
  try {
    const body = await request.json()
    if (body.maxPages && typeof body.maxPages === 'number') {
      newMaxPages = body.maxPages
    }
  } catch {
    // No body or invalid JSON — use default
  }

  // Update audit: reset soft_cap, increase max_pages, resume crawling
  const serviceClient = createServiceClient()
  const { error: updateError } = await serviceClient
    .from('audits')
    .update({
      soft_cap_reached: false,
      max_pages: newMaxPages,
      status: 'crawling',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('[Unified Audit Confirm-Continue Error]', {
      type: 'update_failed',
      auditId: id,
      error: updateError.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to resume audit' }, { status: 500 })
  }

  // Resume crawling in background
  after(async () => {
    try {
      await runUnifiedAuditBatch(id, audit.url)
    } catch (err) {
      console.error('[Unified Audit Confirm-Continue] Background resume failed:', err)
    }
  })

  return NextResponse.json({
    success: true,
    maxPages: newMaxPages,
    message: 'Audit resumed with increased page limit',
  })
}
