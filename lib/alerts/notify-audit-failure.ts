import { createElement } from 'react'
import { sendEmail, FROM_EMAIL } from '@/lib/email/client'
import { createServiceClient } from '@/lib/supabase/server'
import AuditContinuationFailureEmail from '@/emails/audit-continuation-failure'
import type { AuditKind } from '@/lib/unified-audit/trigger-continuation'

interface NotifyAuditContinuationFailureInput {
  auditId: string
  kind: AuditKind
  reason: string
  attempts: number
}

/**
 * Send an operator alert email when an audit's self-continuation chain fails
 * after all retries. Gracefully degrades to logging if ALERT_EMAIL isn't
 * configured — the cron watchdog still picks up the audit, so the email is
 * informational, not load-bearing.
 */
export async function notifyAuditContinuationFailure(
  input: NotifyAuditContinuationFailureInput
): Promise<void> {
  const { auditId, kind, reason, attempts } = input

  const alertEmail = process.env.ALERT_EMAIL
  if (!alertEmail) {
    console.error('[Audit Alert]', {
      type: 'alert_email_not_configured',
      auditId,
      kind,
      reason,
      attempts,
      timestamp: new Date().toISOString(),
    })
    return
  }

  try {
    const supabase = createServiceClient()

    // Fetch audit details for the email body.
    const table = kind === 'unified' ? 'audits' : 'site_audits'
    const { data: audit } = await supabase
      .from(table)
      .select('id, url, organization_id, pages_crawled, current_batch')
      .eq('id', auditId)
      .maybeSingle()

    if (!audit) {
      console.error('[Audit Alert]', {
        type: 'audit_not_found_for_alert',
        auditId,
        kind,
        timestamp: new Date().toISOString(),
      })
      return
    }

    let organizationName: string | null = null
    if (audit.organization_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', audit.organization_id)
        .maybeSingle()
      organizationName = org?.name ?? null
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.selo.io'
    const auditReviewLink =
      kind === 'unified'
        ? audit.organization_id
          ? `${baseUrl}/${audit.organization_id}/seo/audit/${auditId}`
          : `${baseUrl}/quick-audit/${auditId}`
        : audit.organization_id
          ? `${baseUrl}/${audit.organization_id}/seo/site-audit/${auditId}`
          : `${baseUrl}/seo/site-audit/${auditId}`

    // One alert per audit per day. If the same audit fails repeatedly we don't
    // want to spam — the audit-resume cron will retry it regardless.
    const today = new Date().toISOString().slice(0, 10)
    const idempotencyKey = `audit-cont-fail-${auditId}-${today}`

    const result = await sendEmail({
      from: FROM_EMAIL,
      to: alertEmail,
      subject: `[Audit alert] Continuation failed for ${audit.url}`,
      react: createElement(AuditContinuationFailureEmail, {
        auditUrl: audit.url,
        auditReviewLink,
        auditId,
        organizationName,
        pagesCrawled: audit.pages_crawled ?? 0,
        currentBatch: audit.current_batch ?? 0,
        attempts,
        reason,
        detectedAt: new Date().toISOString(),
      }),
      idempotencyKey,
    })

    if (result.error) {
      console.error('[Audit Alert]', {
        type: 'alert_send_failed',
        auditId,
        kind,
        error: result.error.message,
        timestamp: new Date().toISOString(),
      })
    } else {
      console.error('[Audit Alert]', {
        type: 'alert_sent',
        auditId,
        kind,
        messageId: result.data?.id,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('[Audit Alert]', {
      type: 'alert_threw',
      auditId,
      kind,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
  }
}
