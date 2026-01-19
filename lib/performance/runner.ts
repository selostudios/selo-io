import { createServiceClient } from '@/lib/supabase/server'
import { fetchPageSpeedInsights, extractMetrics } from './api'
import type { DeviceType, PerformanceAuditStatus } from './types'

export async function runPerformanceAudit(
  auditId: string,
  urls: string[]
): Promise<void> {
  const supabase = createServiceClient()

  // Update status to running
  await supabase
    .from('performance_audits')
    .update({
      status: 'running' as PerformanceAuditStatus,
      started_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  try {
    const devices: DeviceType[] = ['mobile', 'desktop']

    for (const url of urls) {
      for (const device of devices) {
        try {
          console.log(`[Performance] Auditing ${url} (${device})`)

          const result = await fetchPageSpeedInsights({ url, device })
          const metrics = extractMetrics(result)

          await supabase.from('performance_audit_results').insert({
            audit_id: auditId,
            url,
            device,
            ...metrics,
            raw_response: result,
          })

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`[Performance] Failed to audit ${url} (${device}):`, error)
          // Continue with other URLs even if one fails
        }
      }
    }

    // Mark as completed
    await supabase
      .from('performance_audits')
      .update({
        status: 'completed' as PerformanceAuditStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Performance Runner Error]', { auditId, error: errorMessage })

    await supabase
      .from('performance_audits')
      .update({
        status: 'failed' as PerformanceAuditStatus,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditId)

    throw error
  }
}
