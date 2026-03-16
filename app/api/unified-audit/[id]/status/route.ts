import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import { UnifiedAuditStatus } from '@/lib/enums'
import { computeProgress } from '@/lib/unified-audit/progress'
import { runUnifiedAuditBatch } from '@/lib/unified-audit/runner'

// Audits stuck for more than 15 minutes are considered stale
const STALE_AUDIT_THRESHOLD_MS = 15 * 60 * 1000

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  const membership = (rawUser?.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = rawUser
    ? {
        organization_id: membership?.organization_id ?? null,
        role: membership?.role ?? 'client_viewer',
        is_internal: rawUser.is_internal,
      }
    : null

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let { data: audit } = await supabase.from('audits').select('*').eq('id', id).single()

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Verify access
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  // Stale detection
  if (
    audit.status === UnifiedAuditStatus.Crawling ||
    audit.status === UnifiedAuditStatus.Checking ||
    audit.status === UnifiedAuditStatus.Analyzing ||
    audit.status === UnifiedAuditStatus.BatchComplete
  ) {
    const timestamp = audit.updated_at || audit.created_at
    const updatedAt = new Date(timestamp).getTime()
    const now = Date.now()
    const isStale = !isNaN(updatedAt) && now - updatedAt > STALE_AUDIT_THRESHOLD_MS

    if (isStale) {
      const serviceClient = createServiceClient()

      if (audit.status === UnifiedAuditStatus.BatchComplete) {
        // Auto-resume stale batch_complete
        console.log('[Unified Audit Status] Auto-resuming stale batch_complete audit', {
          auditId: id,
          timestamp: new Date().toISOString(),
        })

        after(async () => {
          try {
            await runUnifiedAuditBatch(id, audit.url)
          } catch (err) {
            console.error('[Unified Audit Status] Auto-resume failed:', err)
          }
        })
      } else {
        // Mark as failed (timeout)
        const { data: updatedAudit } = await serviceClient
          .from('audits')
          .update({
            status: UnifiedAuditStatus.Failed,
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

        console.log('[Unified Audit Status] Marked stale audit as failed', {
          auditId: id,
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  // Get check counts
  const { count: checkCount } = await supabase
    .from('audit_checks')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', id)

  // Estimate total checks (pages * page-specific checks + site-wide checks)
  const totalChecks = Math.max(
    (audit.pages_crawled || 0) * 15 + 12, // rough estimate
    checkCount || 0
  )

  // Count PSI-enhanced checks (checks with source = 'psi' in details)
  const { count: psiCheckCount } = await supabase
    .from('audit_checks')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', id)
    .eq('details->>source', 'psi')

  // Count distinct pages with PSI data
  const psiPagesCompleted = psiCheckCount ? Math.floor(psiCheckCount / 3) : 0 // 3 checks per page

  // Count AI analyses
  const { count: aiAnalysisCount } = await supabase
    .from('audit_ai_analyses')
    .select('*', { count: 'exact', head: true })
    .eq('audit_id', id)

  const sampleSize = audit.sample_size ?? 5

  const progress = computeProgress(
    {
      status: audit.status as UnifiedAuditStatus,
      pages_crawled: audit.pages_crawled ?? 0,
      max_pages: audit.max_pages ?? 100,
      overall_score: audit.overall_score,
    },
    checkCount || 0,
    totalChecks,
    {
      psiCompleted: psiPagesCompleted,
      psiTotal: sampleSize,
      aiCompleted: aiAnalysisCount || 0,
      aiTotal: audit.ai_analysis_enabled ? sampleSize : 0,
    }
  )

  return NextResponse.json({
    id: audit.id,
    status: audit.status,
    url: audit.url,
    crawl_mode: audit.crawl_mode,
    pages_crawled: audit.pages_crawled,
    overall_score: audit.overall_score,
    seo_score: audit.seo_score,
    performance_score: audit.performance_score,
    ai_readiness_score: audit.ai_readiness_score,
    failed_count: audit.failed_count,
    warning_count: audit.warning_count,
    passed_count: audit.passed_count,
    error_message: audit.error_message,
    started_at: audit.started_at,
    completed_at: audit.completed_at,
    progress,
  })
}
