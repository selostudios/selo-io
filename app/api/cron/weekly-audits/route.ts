import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runUnifiedAuditBatch } from '@/lib/unified-audit/runner'
import { UnifiedAuditStatus } from '@/lib/enums'

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all monitored sites
  const { data: sites, error } = await supabase
    .from('monitored_sites')
    .select('id, organization_id, url, run_site_audit, run_performance_audit')

  if (error) {
    console.error('[Cron Error]', {
      type: 'fetch_monitored_sites_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }

  const results = {
    audits_started: 0,
    errors: [] as string[],
  }

  // Collect site IDs that were processed so we can batch-update timestamps
  const processedSiteIds: string[] = []

  for (const site of sites || []) {
    // Run unified audit if any audit type is enabled
    if (site.run_site_audit || site.run_performance_audit) {
      try {
        const { data: audit, error: insertError } = await supabase
          .from('audits')
          .insert({
            organization_id: site.organization_id,
            url: site.url,
            domain: new URL(site.url).hostname.replace(/^www\./, ''),
            status: UnifiedAuditStatus.Pending,
            crawl_mode: 'full',
          })
          .select('id')
          .single()

        if (insertError) {
          results.errors.push(`Audit insert for ${site.url}: ${insertError.message}`)
          continue
        }

        if (audit) {
          runUnifiedAuditBatch(audit.id, site.url).catch(async (err) => {
            console.error('[Cron Error]', {
              type: 'unified_audit_failed',
              url: site.url,
              timestamp: new Date().toISOString(),
              error: err.message,
            })
            await supabase
              .from('audits')
              .update({
                status: UnifiedAuditStatus.Failed,
                error_message: err.message,
                completed_at: new Date().toISOString(),
              })
              .eq('id', audit.id)
              .in('status', [
                UnifiedAuditStatus.Pending,
                UnifiedAuditStatus.Crawling,
                UnifiedAuditStatus.Checking,
              ])
          })
          results.audits_started++
          processedSiteIds.push(site.id)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Audit for ${site.url}: ${errorMessage}`)
      }
    }
  }

  // Batch-update last audit timestamps for all processed sites in one query
  if (processedSiteIds.length > 0) {
    const now = new Date().toISOString()
    await supabase
      .from('monitored_sites')
      .update({ last_site_audit_at: now, last_performance_audit_at: now })
      .in('id', processedSiteIds)
  }

  console.error('[Cron Info]', {
    type: 'weekly_audits_completed',
    timestamp: new Date().toISOString(),
    results,
  })

  return NextResponse.json(results)
}
