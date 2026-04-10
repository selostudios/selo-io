import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Resend webhook handler for email delivery events.
 *
 * Processes bounce and complaint events to maintain the email
 * suppression list. Verifies webhook signatures via Svix.
 *
 * Configure in Resend dashboard:
 *   URL: https://your-domain.com/api/webhooks/resend
 *   Events: email.bounced, email.complained
 *   Signing secret → RESEND_WEBHOOK_SECRET env var
 */

interface ResendWebhookEvent {
  type: string
  created_at: string
  data: {
    email_id: string
    to: string[]
    bounce?: { type: string }
  }
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[Resend Webhook]', {
      type: 'missing_secret',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Verify webhook signature
  const body = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
  }

  let event: ResendWebhookEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookEvent
  } catch {
    console.error('[Resend Webhook]', {
      type: 'signature_verification_failed',
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Process event
  const supabase = createServiceClient()

  switch (event.type) {
    case 'email.bounced': {
      // Only suppress on hard bounces (permanent delivery failures)
      const isHardBounce = event.data.bounce?.type !== 'transient'
      if (!isHardBounce) break

      for (const email of event.data.to) {
        const { error } = await supabase.from('email_suppressions').upsert(
          {
            email: email.toLowerCase(),
            reason: 'hard_bounce',
            source: 'resend_webhook',
            source_event_id: svixId,
          },
          { onConflict: 'source_event_id' }
        )
        if (error) {
          console.error('[Resend Webhook]', {
            type: 'suppression_insert_failed',
            email,
            error: error.message,
            timestamp: new Date().toISOString(),
          })
        }
      }

      console.error('[Resend Webhook]', {
        type: 'hard_bounce_suppressed',
        count: event.data.to.length,
        timestamp: new Date().toISOString(),
      })
      break
    }

    case 'email.complained': {
      for (const email of event.data.to) {
        const { error } = await supabase.from('email_suppressions').upsert(
          {
            email: email.toLowerCase(),
            reason: 'complaint',
            source: 'resend_webhook',
            source_event_id: svixId,
          },
          { onConflict: 'source_event_id' }
        )
        if (error) {
          console.error('[Resend Webhook]', {
            type: 'suppression_insert_failed',
            email,
            error: error.message,
            timestamp: new Date().toISOString(),
          })
        }
      }

      console.error('[Resend Webhook]', {
        type: 'complaint_suppressed',
        count: event.data.to.length,
        timestamp: new Date().toISOString(),
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
