import { createServiceClient } from '@/lib/supabase/server'
import { UsageFeature } from '@/lib/enums'

/**
 * Check if sync can continue given current spend vs budget.
 * Budget of 0 means unlimited.
 */
export function canContinueSync(currentSpendCents: number, budgetCents: number): boolean {
  if (budgetCents === 0) return true
  return currentSpendCents < budgetCents
}

interface ThresholdInput {
  currentSpendCents: number
  budgetCents: number
  thresholdPercent: number
  lastAlertType: string | null
}

/**
 * Determine if a budget alert should be sent.
 * Returns 'approaching', 'exceeded', or null (no alert needed).
 * Deduplicates: won't return the same alert type that was already sent.
 */
export function checkBudgetThresholds(input: ThresholdInput): 'approaching' | 'exceeded' | null {
  const { currentSpendCents, budgetCents, thresholdPercent, lastAlertType } = input

  if (budgetCents === 0) return null

  const spendPercent = (currentSpendCents / budgetCents) * 100

  if (spendPercent >= 100 && lastAlertType !== 'exceeded') {
    return 'exceeded'
  }

  if (spendPercent >= thresholdPercent && lastAlertType === null) {
    return 'approaching'
  }

  return null
}

/**
 * Get current month's AI Visibility spend for an org from usage_logs.
 */
export async function getCurrentMonthSpend(organizationId: string): Promise<number> {
  const supabase = createServiceClient()

  const now = new Date()
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const { data, error } = await supabase
    .from('usage_logs')
    .select('cost')
    .eq('organization_id', organizationId)
    .eq('feature', UsageFeature.AIVisibility)
    .gte('created_at', startOfMonth.toISOString())

  if (error) {
    console.error('[AI Visibility Budget]', {
      type: 'spend_query_failed',
      organizationId,
      error: error.message,
      timestamp: new Date().toISOString(),
    })
    return 0
  }

  return (data ?? []).reduce((sum, row) => sum + (row.cost ?? 0), 0)
}
