/**
 * Runtime infrastructure alert — fires when the app encounters an error so
 * fundamental that Supabase / app-settings cannot be trusted to resolve
 * credentials (e.g. env vars missing, middleware throwing, DB unreachable).
 *
 * Must have zero dependencies on Supabase or the standard email client —
 * both route through the database and would fail at the same time as the
 * thing we're trying to alert about.
 *
 * Uses the Resend HTTP API directly. If RESEND_API_KEY / RESEND_FROM_EMAIL /
 * ALERT_EMAIL are missing, logs and returns silently (no cascading failure).
 */

type InfraAlertType =
  | 'missing_env'
  | 'supabase_client_init_failed'
  | 'middleware_threw'
  | 'unhandled_server_error'

interface NotifyInfraFailureInput {
  type: InfraAlertType
  message: string
  context?: Record<string, unknown>
}

/** In-memory dedupe: one alert per type per hour per serverless instance. */
const DEDUPE_WINDOW_MS = 60 * 60 * 1000
const lastSentAt = new Map<InfraAlertType, number>()

export async function notifyInfraFailure(input: NotifyInfraFailureInput): Promise<void> {
  const { type, message, context } = input

  const now = Date.now()
  const last = lastSentAt.get(type)
  if (last && now - last < DEDUPE_WINDOW_MS) {
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const to = process.env.ALERT_EMAIL

  if (!apiKey || !from || !to) {
    console.error('[Infra Alert]', {
      type: 'alert_env_missing',
      missing: {
        RESEND_API_KEY: !apiKey,
        RESEND_FROM_EMAIL: !from,
        ALERT_EMAIL: !to,
      },
      originalType: type,
      originalMessage: message,
      timestamp: new Date().toISOString(),
    })
    return
  }

  lastSentAt.set(type, now)

  const deployUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '(local)'
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown'
  const region = process.env.VERCEL_REGION ?? 'unknown'
  const timestamp = new Date().toISOString()

  const contextBlock = context
    ? `\n\nContext:\n${Object.entries(context)
        .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
        .join('\n')}`
    : ''

  const body = [
    `An infrastructure-level failure was detected in production.`,
    ``,
    `Type: ${type}`,
    `Message: ${message}`,
    `Deployment: ${deployUrl}`,
    `Commit: ${commitSha}`,
    `Region: ${region}`,
    `Timestamp: ${timestamp}`,
    contextBlock,
  ].join('\n')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[Selo infra] ${type} — ${deployUrl}`,
        text: body,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '(unreadable)')
      console.error('[Infra Alert]', {
        type: 'alert_send_failed',
        status: response.status,
        body: errorBody,
        originalType: type,
        timestamp,
      })
      lastSentAt.delete(type)
    }
  } catch (err) {
    console.error('[Infra Alert]', {
      type: 'alert_threw',
      error: err instanceof Error ? err.message : String(err),
      originalType: type,
      timestamp,
    })
    lastSentAt.delete(type)
  }
}
