import { createServiceClient } from '@/lib/supabase/server'
import { fetchPageSpeedInsights, extractMetrics } from './api'
import type { DeviceType, PerformanceAuditStatus } from './types'

export async function runPerformanceAudit(auditId: string, urls: string[]): Promise<void> {
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
    let successCount = 0
    let failureCount = 0
    let lastError: string | null = null

    for (const url of urls) {
      for (const device of devices) {
        try {
          console.log(`[Performance] Auditing ${url} (${device})`)

          const result = await fetchPageSpeedInsights({ url, device })
          const metrics = extractMetrics(result)

          const { error: insertError } = await supabase.from('performance_audit_results').insert({
            audit_id: auditId,
            url,
            device,
            ...metrics,
            raw_response: result,
          })

          if (insertError) {
            console.error('[Performance Error]', {
              type: 'insert_failed',
              url,
              device,
              error: insertError.message,
              timestamp: new Date().toISOString(),
            })
            failureCount++
            lastError = insertError.message
          } else {
            successCount++
          }

          // Small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('[Performance Error]', {
            type: 'audit_failed',
            url,
            device,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          })
          failureCount++
          lastError = errorMessage
          // Continue with other URLs even if one fails
        }
      }
    }

    // Determine final status based on success/failure counts
    if (successCount === 0 && failureCount > 0) {
      // All failed
      await supabase
        .from('performance_audits')
        .update({
          status: 'failed' as PerformanceAuditStatus,
          error_message: lastError || 'All page audits failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditId)
    } else {
      // At least some succeeded
      await supabase
        .from('performance_audits')
        .update({
          status: 'completed' as PerformanceAuditStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditId)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Performance Error]', {
      type: 'runner_failed',
      auditId,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    })

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
