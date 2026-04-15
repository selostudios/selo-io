/**
 * Self-continuation trigger for the audit batch pipeline.
 *
 * When a batch runner approaches the Vercel function duration limit it calls
 * this helper to POST to `/api/(unified-audit|audit)/[id]/continue`, spawning
 * a fresh function invocation that picks up where the previous one left off.
 *
 * Because the whole browser-free audit flow relies on this chain holding, a
 * single transient failure used to orphan the audit in `batch_complete` until
 * someone opened the status page (the stale-detection path in the status
 * endpoint). This helper adds retries with exponential backoff + jitter, a
 * longer per-attempt timeout to survive cold starts, and escalates to an
 * alert only after all retries are exhausted.
 */
export type AuditKind = 'unified' | 'legacy'

export interface ContinuationFailureInfo {
  auditId: string
  kind: AuditKind
  reason: string
  attempts: number
}

export interface TriggerAuditContinuationOptions {
  auditId: string
  kind: AuditKind
  /**
   * Called once if every retry fails. The caller is responsible for
   * recording the failure (e.g. sending an email alert or updating the
   * audit record with a failure note).
   */
  notifyOnFailure: (info: ContinuationFailureInfo) => Promise<void> | void
}

export interface TriggerAuditContinuationResult {
  success: boolean
  attempts: number
  lastError?: string
}

const MAX_ATTEMPTS = 3
// Exponential backoff base delays (ms). Each is multiplied by a ±20% jitter.
const BACKOFF_BASE_MS = [1000, 3000, 9000]
// Per-attempt fetch timeout. 10s was not enough to survive Vercel cold starts.
const PER_ATTEMPT_TIMEOUT_MS = 20_000

function resolveBaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  )
}

function pathForKind(kind: AuditKind, auditId: string): string {
  return kind === 'unified'
    ? `/api/unified-audit/${auditId}/continue`
    : `/api/audit/${auditId}/continue`
}

function jitter(baseMs: number): number {
  // ±20% jitter to avoid thundering-herd effects on the target function.
  const range = baseMs * 0.2
  return Math.round(baseMs - range + Math.random() * range * 2)
}

function isRetryable(status: number): boolean {
  // 5xx is always retryable. 408 (request timeout) and 429 (rate limited) are
  // transient. Other 4xx (401/403/404/etc.) is a semantic failure — don't retry.
  return status >= 500 || status === 408 || status === 429
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function attemptContinuation(
  url: string,
  cronSecret: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'x-cron-secret': cronSecret },
      signal: AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS),
    })

    // 2xx and 409 both indicate successful handoff — 409 means the audit has
    // already been claimed by another invocation (e.g. polling hit it first).
    if (response.ok || response.status === 409) {
      return { ok: true, status: response.status }
    }
    return { ok: false, status: response.status, error: `HTTP ${response.status}` }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function triggerAuditContinuation(
  options: TriggerAuditContinuationOptions
): Promise<TriggerAuditContinuationResult> {
  const { auditId, kind, notifyOnFailure } = options

  const baseUrl = resolveBaseUrl()
  if (!baseUrl) {
    const reason = 'No base URL configured (missing NEXT_PUBLIC_SITE_URL and VERCEL_URL)'
    console.error('[Audit Continuation]', {
      type: 'trigger_failed',
      auditId,
      kind,
      reason,
      attempts: 0,
      timestamp: new Date().toISOString(),
    })
    try {
      await notifyOnFailure({ auditId, kind, reason, attempts: 0 })
    } catch (notifyErr) {
      console.error('[Audit Continuation] notifyOnFailure threw:', notifyErr)
    }
    return { success: false, attempts: 0, lastError: reason }
  }

  const url = `${baseUrl}${pathForKind(kind, auditId)}`
  const cronSecret = process.env.CRON_SECRET || ''

  let lastError = ''
  let lastStatus: number | undefined

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await attemptContinuation(url, cronSecret)

    if (result.ok) {
      console.error('[Audit Continuation]', {
        type: 'trigger_succeeded',
        auditId,
        kind,
        attempt,
        status: result.status,
        timestamp: new Date().toISOString(),
      })
      return { success: true, attempts: attempt }
    }

    lastError = result.error ?? `HTTP ${result.status ?? 'unknown'}`
    lastStatus = result.status

    console.error('[Audit Continuation]', {
      type: 'trigger_attempt_failed',
      auditId,
      kind,
      attempt,
      status: result.status,
      error: result.error,
      timestamp: new Date().toISOString(),
    })

    // Non-retryable status — give up immediately.
    if (typeof result.status === 'number' && !isRetryable(result.status)) {
      break
    }

    // Back off before next attempt (skip sleep on final iteration).
    if (attempt < MAX_ATTEMPTS) {
      await sleep(jitter(BACKOFF_BASE_MS[attempt - 1]))
    }
  }

  const attempts = typeof lastStatus === 'number' && !isRetryable(lastStatus) ? 1 : MAX_ATTEMPTS
  console.error('[Audit Continuation]', {
    type: 'trigger_exhausted',
    auditId,
    kind,
    attempts,
    lastError,
    timestamp: new Date().toISOString(),
  })

  try {
    await notifyOnFailure({ auditId, kind, reason: lastError, attempts })
  } catch (notifyErr) {
    console.error('[Audit Continuation] notifyOnFailure threw:', notifyErr)
  }

  return { success: false, attempts, lastError }
}
