import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Audits stuck in crawling/checking for more than 15 minutes are considered stale
// (Vercel function timeout is 800 seconds / ~13 minutes, so 15 minutes catches timeouts)
const STALE_AUDIT_THRESHOLD_MS = 15 * 60 * 1000

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ hasSiteAudit: false, hasPerformanceAudit: false })
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ hasSiteAudit: false, hasPerformanceAudit: false })
  }

  let hasSiteAudit = false
  let hasPerformanceAudit = false

  // Check for active site audits
  const { data: activeAudit } = await supabase
    .from('site_audits')
    .select('id, status, updated_at, created_at')
    .eq('organization_id', userRecord.organization_id)
    .in('status', ['pending', 'crawling', 'checking'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (activeAudit) {
    // Check if audit is stale (stuck for too long)
    const timestamp = activeAudit.updated_at || activeAudit.created_at
    const updatedAt = new Date(timestamp).getTime()
    const now = Date.now()
    const isStale = !isNaN(updatedAt) && now - updatedAt > STALE_AUDIT_THRESHOLD_MS

    if (isStale && (activeAudit.status === 'crawling' || activeAudit.status === 'checking')) {
      // Mark stale audit as failed using service client (bypasses RLS)
      const serviceClient = createServiceClient()
      await serviceClient
        .from('site_audits')
        .update({
          status: 'failed',
          error_message:
            'Audit timed out - the server function was terminated before completion. Please try again.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activeAudit.id)

      console.log('[Audit Active Check] Marked stale audit as failed', {
        auditId: activeAudit.id,
        status: activeAudit.status,
        updatedAt: activeAudit.updated_at,
        timestamp: new Date().toISOString(),
      })
    } else {
      hasSiteAudit = true
    }
  }

  // Check for active performance audits
  const { data: activePerformanceAudit } = await supabase
    .from('performance_audits')
    .select('id, status, updated_at, created_at')
    .eq('organization_id', userRecord.organization_id)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (activePerformanceAudit) {
    // Check if performance audit is stale (stuck for too long)
    const timestamp = activePerformanceAudit.updated_at || activePerformanceAudit.created_at
    const updatedAt = new Date(timestamp).getTime()
    const now = Date.now()
    const isStale = !isNaN(updatedAt) && now - updatedAt > STALE_AUDIT_THRESHOLD_MS

    if (isStale && activePerformanceAudit.status === 'running') {
      // Mark stale performance audit as failed using service client (bypasses RLS)
      const serviceClient = createServiceClient()
      await serviceClient
        .from('performance_audits')
        .update({
          status: 'failed',
          error_message:
            'Audit timed out - the server function was terminated before completion. Please try again.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activePerformanceAudit.id)

      console.log('[Performance Audit Active Check] Marked stale audit as failed', {
        auditId: activePerformanceAudit.id,
        status: activePerformanceAudit.status,
        updatedAt: activePerformanceAudit.updated_at,
        timestamp: new Date().toISOString(),
      })
    } else {
      hasPerformanceAudit = true
    }
  }

  return NextResponse.json({ hasSiteAudit, hasPerformanceAudit })
}
