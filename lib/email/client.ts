import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { createServiceClient } from '@/lib/supabase/server'

export const resend = new Resend(process.env.RESEND_API_KEY!)

if (!process.env.RESEND_FROM_EMAIL) {
  console.error('[Email] RESEND_FROM_EMAIL is not set — emails will fail in production')
}
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Selo IO <onboarding@resend.dev>'

const USE_MAILPIT = process.env.USE_MAILPIT === 'true'

// Mailpit SMTP transport for local development
const mailpitTransport = nodemailer.createTransport({
  host: '127.0.0.1',
  port: 54325,
  secure: false,
})

interface SendEmailOptions {
  from: string
  to: string
  subject: string
  react: ReactElement
  /** Deterministic key to prevent duplicate sends (e.g. `invite-${inviteId}`) */
  idempotencyKey?: string
  /** Additional headers (e.g. List-Unsubscribe) */
  headers?: Record<string, string>
}

interface SendEmailResult {
  data: { id: string } | null
  error: { message: string } | null
}

/**
 * Check if an email address is on the suppression list (hard bounce or complaint).
 * Uses the service client to bypass RLS.
 */
async function isSuppressed(email: string): Promise<boolean> {
  try {
    const supabase = createServiceClient()
    const { count } = await supabase
      .from('email_suppressions')
      .select('id', { count: 'exact', head: true })
      .ilike('email', email)

    return (count ?? 0) > 0
  } catch {
    // If suppression check fails, allow the send (fail-open)
    // rather than blocking legitimate emails
    return false
  }
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { from, to, subject, react, idempotencyKey, headers } = options

  // Check suppression list before sending
  if (await isSuppressed(to)) {
    console.error('[Email]', {
      type: 'suppressed',
      to,
      timestamp: new Date().toISOString(),
    })
    return { data: null, error: { message: 'Recipient is on suppression list' } }
  }

  if (USE_MAILPIT) {
    try {
      const html = await render(react)
      const info = await mailpitTransport.sendMail({
        from,
        to,
        subject,
        html,
        headers: headers || undefined,
      })
      if (process.env.NODE_ENV === 'development') {
        console.error('[Email] Sent via Mailpit:', info.messageId)
      }
      return { data: { id: info.messageId }, error: null }
    } catch (err) {
      console.error('[Email] Mailpit error:', err)
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : 'Mailpit send failed' },
      }
    }
  }

  // Production: use Resend
  const result = await resend.emails.send({
    from,
    to,
    subject,
    react,
    headers: headers || undefined,
    ...(idempotencyKey && {
      headers: {
        ...headers,
        'X-Entity-Ref-ID': idempotencyKey,
      },
    }),
  })

  return result
}
