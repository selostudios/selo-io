import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { UnifiedAuditStatus } from '@/lib/enums'

// Audits stuck in crawling/checking for more than 15 minutes are considered stale
// (Vercel function timeout is 800 seconds / ~13 minutes, so 15 minutes catches timeouts)
const STALE_AUDIT_THRESHOLD_MS = 15 * 60 * 1000

const IN_PROGRESS_STATUSES = [
  UnifiedAuditStatus.Pending,
  UnifiedAuditStatus.Crawling,
  UnifiedAuditStatus.Checking,
  UnifiedAuditStatus.Analyzing,
  UnifiedAuditStatus.BatchComplete,
  UnifiedAuditStatus.AwaitingConfirmation,
]

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Get optional org parameter from query string
  const requestedOrgId = request.nextUrl.searchParams.get('org')

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ hasActiveAudit: false })
  }

  // Get user's organization and internal status via team_members
  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  if (!rawUser) {
    return NextResponse.json({ hasActiveAudit: false })
  }

  const userOrgId =
    (rawUser.team_members as { organization_id: string }[])?.[0]?.organization_id ?? null

  // Determine which organization to check
  const targetOrgId = rawUser.is_internal ? requestedOrgId || userOrgId : userOrgId

  if (!targetOrgId) {
    return NextResponse.json({ hasActiveAudit: false })
  }

  // Check for active unified audits
  const { data: activeAudit } = await supabase
    .from('audits')
    .select('id, status, updated_at, created_at')
    .eq('organization_id', targetOrgId)
    .in('status', IN_PROGRESS_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!activeAudit) {
    return NextResponse.json({ hasActiveAudit: false })
  }

  // Check if audit is stale (stuck for too long)
  const timestamp = activeAudit.updated_at || activeAudit.created_at
  const updatedAt = new Date(timestamp).getTime()
  const now = Date.now()
  const isStale = !isNaN(updatedAt) && now - updatedAt > STALE_AUDIT_THRESHOLD_MS

  if (
    isStale &&
    (activeAudit.status === UnifiedAuditStatus.Crawling ||
      activeAudit.status === UnifiedAuditStatus.Checking)
  ) {
    // Mark stale audit as failed using service client (bypasses RLS)
    const serviceClient = createServiceClient()
    await serviceClient
      .from('audits')
      .update({
        status: UnifiedAuditStatus.Failed,
        error_message:
          'Audit timed out - the server function was terminated before completion. Please try again.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', activeAudit.id)

    console.error('[Audit Active Check] Marked stale audit as failed', {
      auditId: activeAudit.id,
      status: activeAudit.status,
      updatedAt: activeAudit.updated_at,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ hasActiveAudit: false })
  }

  return NextResponse.json({ hasActiveAudit: true })
}
