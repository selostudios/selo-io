import { createServiceClient } from '@/lib/supabase/server'

interface UsageOptions {
  organizationId?: string | null
  tokensInput?: number
  tokensOutput?: number
  cost?: number
  metadata?: Record<string, unknown>
}

/**
 * Log a billable API call. Fire-and-forget — never throws.
 * Uses service client to bypass RLS.
 */
export async function logUsage(
  service: string,
  eventType: string,
  opts: UsageOptions = {}
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('usage_logs').insert({
      service,
      event_type: eventType,
      organization_id: opts.organizationId ?? null,
      tokens_input: opts.tokensInput ?? null,
      tokens_output: opts.tokensOutput ?? null,
      cost: opts.cost ?? null,
      metadata: opts.metadata ?? null,
    })

    if (error) {
      console.error('[Usage Log Error]', {
        type: 'insert_failed',
        service,
        eventType,
        timestamp: new Date().toISOString(),
        error: error.message,
      })
    }
  } catch (err) {
    console.error('[Usage Log Error]', {
      type: 'unexpected',
      service,
      eventType,
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
