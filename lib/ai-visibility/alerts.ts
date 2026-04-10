import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/client'
import AIVisibilityBudgetAlert from '@/emails/ai-visibility-budget-alert'

interface BudgetAlertInput {
  organizationId: string
  orgName: string
  alertType: 'approaching' | 'exceeded'
  currentSpendCents: number
  budgetCents: number
  thresholdPercent: number
}

/**
 * Send budget alert emails to all internal users and update config.
 * Fire-and-forget: never throws.
 */
export async function sendBudgetAlert(input: BudgetAlertInput): Promise<void> {
  const { organizationId, orgName, alertType, currentSpendCents, budgetCents, thresholdPercent } =
    input

  try {
    const supabase = createServiceClient()

    // Get all internal user emails
    const { data: internalUsers, error: usersError } = await supabase
      .from('users')
      .select('email')
      .eq('is_internal', true)

    if (usersError || !internalUsers?.length) {
      console.error('[AI Visibility Alert]', {
        type: 'no_internal_users',
        organizationId,
        error: usersError?.message,
        timestamp: new Date().toISOString(),
      })
      return
    }

    const subject =
      alertType === 'exceeded'
        ? `Budget exceeded: ${orgName} AI Visibility syncs paused`
        : `Budget alert: ${orgName} AI Visibility at ${Math.round((currentSpendCents / budgetCents) * 100)}%`

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'Selo IO <onboarding@resend.dev>'

    // Send to each internal user
    const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM
    await Promise.all(
      internalUsers.map((user) =>
        sendEmail({
          from: fromEmail,
          to: user.email,
          subject,
          react: AIVisibilityBudgetAlert({
            orgName,
            alertType,
            currentSpendCents,
            budgetCents,
            thresholdPercent,
          }),
          idempotencyKey: `budget-alert-${organizationId}-${alertType}-${monthKey}-${user.email}`,
        })
      )
    )

    // Update config to prevent duplicate alerts
    await supabase
      .from('ai_visibility_configs')
      .update({
        last_alert_type: alertType,
        last_alert_sent_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId)
  } catch (error) {
    console.error('[AI Visibility Alert]', {
      type: 'alert_send_failed',
      organizationId,
      alertType,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
