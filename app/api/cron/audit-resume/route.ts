import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { UnifiedAuditStatus, AuditStatus } from '@/lib/enums'
import { triggerAuditContinuation } from '@/lib/unified-audit/trigger-continuation'
import { notifyAuditContinuationFailure } from '@/lib/alerts/notify-audit-failure'

// Audits sitting in batch_complete longer than this are resumed.
const RESUME_STALE_MINUTES = 10
// Audits stuck in crawling/checking/analyzing longer than this are marked failed.
const FAIL_STALE_MINUTES = 30

export const maxDuration = 60

interface ResumeResult {
  resumed: string[]
  failed: string[]
  errors: string[]
}

/**
 * Watchdog for audits whose self-continuation chain has broken.
 *
 * Two recovery paths:
 *   1. status = 'batch_complete' AND updated_at < now - 10 min
 *      → Re-trigger continuation (same path as runner's own hand-off).
 *   2. status IN ('crawling','checking','analyzing') AND updated_at < now - 30 min
 *      → Mark as failed with a timeout message. Crawling should always be making
 *        forward progress (updated_at refreshed by the runner); 30 min idle means
 *        the function was killed before it could set batch_complete.
 *
 * Runs both the legacy (`site_audits`) and unified (`audits`) tables.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [unifiedResult, legacyResult] = await Promise.all([
      resumeUnifiedAudits(),
      resumeLegacyAudits(),
    ])

    console.error('[Cron Info]', {
      type: 'audit_resume_completed',
      unified: unifiedResult,
      legacy: legacyResult,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      unified: unifiedResult,
      legacy: legacyResult,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Cron Error]', {
      type: 'audit_resume_failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

async function resumeUnifiedAudits(): Promise<ResumeResult> {
  const supabase = createServiceClient()
  const resumeCutoff = new Date(Date.now() - RESUME_STALE_MINUTES * 60 * 1000).toISOString()
  const failCutoff = new Date(Date.now() - FAIL_STALE_MINUTES * 60 * 1000).toISOString()

  const result: ResumeResult = { resumed: [], failed: [], errors: [] }

  // Path 1: resume stale batch_complete audits.
  const { data: toResume, error: resumeErr } = await supabase
    .from('audits')
    .select('id, url')
    .eq('status', UnifiedAuditStatus.BatchComplete)
    .lt('updated_at', resumeCutoff)

  if (resumeErr) {
    result.errors.push(`unified resume query: ${resumeErr.message}`)
  }

  for (const audit of toResume ?? []) {
    const triggerResult = await triggerAuditContinuation({
      auditId: audit.id,
      kind: 'unified',
      notifyOnFailure: notifyAuditContinuationFailure,
    })
    if (triggerResult.success) {
      result.resumed.push(audit.id)
    } else {
      result.errors.push(`unified resume ${audit.id}: ${triggerResult.lastError ?? 'unknown'}`)
    }
  }

  // Path 2: fail audits stuck mid-phase.
  const { data: toFail, error: failErr } = await supabase
    .from('audits')
    .select('id')
    .in('status', [
      UnifiedAuditStatus.Crawling,
      UnifiedAuditStatus.Checking,
      UnifiedAuditStatus.Analyzing,
    ])
    .lt('updated_at', failCutoff)

  if (failErr) {
    result.errors.push(`unified fail query: ${failErr.message}`)
  }

  for (const audit of toFail ?? []) {
    const { error: updateErr } = await supabase
      .from('audits')
      .update({
        status: UnifiedAuditStatus.Failed,
        error_message:
          'Audit timed out — the function stopped making progress for over 30 minutes. Please try again.',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', audit.id)
      .in('status', [
        UnifiedAuditStatus.Crawling,
        UnifiedAuditStatus.Checking,
        UnifiedAuditStatus.Analyzing,
      ])

    if (updateErr) {
      result.errors.push(`unified fail ${audit.id}: ${updateErr.message}`)
    } else {
      result.failed.push(audit.id)
    }
  }

  return result
}

async function resumeLegacyAudits(): Promise<ResumeResult> {
  const supabase = createServiceClient()
  const resumeCutoff = new Date(Date.now() - RESUME_STALE_MINUTES * 60 * 1000).toISOString()
  const failCutoff = new Date(Date.now() - FAIL_STALE_MINUTES * 60 * 1000).toISOString()

  const result: ResumeResult = { resumed: [], failed: [], errors: [] }

  const { data: toResume, error: resumeErr } = await supabase
    .from('site_audits')
    .select('id')
    .eq('status', AuditStatus.BatchComplete)
    .lt('updated_at', resumeCutoff)

  if (resumeErr) {
    result.errors.push(`legacy resume query: ${resumeErr.message}`)
  }

  for (const audit of toResume ?? []) {
    const triggerResult = await triggerAuditContinuation({
      auditId: audit.id,
      kind: 'legacy',
      notifyOnFailure: notifyAuditContinuationFailure,
    })
    if (triggerResult.success) {
      result.resumed.push(audit.id)
    } else {
      result.errors.push(`legacy resume ${audit.id}: ${triggerResult.lastError ?? 'unknown'}`)
    }
  }

  const { data: toFail, error: failErr } = await supabase
    .from('site_audits')
    .select('id')
    .in('status', [AuditStatus.Crawling, AuditStatus.Checking])
    .lt('updated_at', failCutoff)

  if (failErr) {
    result.errors.push(`legacy fail query: ${failErr.message}`)
  }

  for (const audit of toFail ?? []) {
    const { error: updateErr } = await supabase
      .from('site_audits')
      .update({
        status: AuditStatus.Failed,
        error_message:
          'Audit timed out — the function stopped making progress for over 30 minutes. Please try again.',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', audit.id)
      .in('status', [AuditStatus.Crawling, AuditStatus.Checking])

    if (updateErr) {
      result.errors.push(`legacy fail ${audit.id}: ${updateErr.message}`)
    } else {
      result.failed.push(audit.id)
    }
  }

  return result
}
