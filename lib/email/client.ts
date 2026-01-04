import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { render } from '@react-email/components'
import type { ReactElement } from 'react'

export const resend = new Resend(process.env.RESEND_API_KEY!)

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
}

interface SendEmailResult {
  data: { id: string } | null
  error: { message: string } | null
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { from, to, subject, react } = options

  if (USE_MAILPIT) {
    try {
      const html = await render(react)
      const info = await mailpitTransport.sendMail({
        from,
        to,
        subject,
        html,
      })
      console.log('[Email] Sent via Mailpit:', info.messageId)
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
  })

  return result
}
