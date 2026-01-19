import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/runner'
import { runPerformanceAudit } from '@/lib/performance/runner'

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all monitored sites
  const { data: sites, error } = await supabase.from('monitored_sites').select('*')

  if (error) {
    console.error('[Cron Error]', {
      type: 'fetch_monitored_sites_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }

  const results = {
    site_audits_started: 0,
    performance_audits_started: 0,
    errors: [] as string[],
  }

  for (const site of sites || []) {
    // Run Site Audit if enabled
    if (site.run_site_audit) {
      try {
        const { data: audit, error: insertError } = await supabase
          .from('site_audits')
          .insert({
            organization_id: site.organization_id,
            url: site.url,
            status: 'pending',
          })
          .select()
          .single()

        if (insertError) {
          results.errors.push(`Site audit insert for ${site.url}: ${insertError.message}`)
          continue
        }

        if (audit) {
          runAudit(audit.id, site.url).catch((err) => {
            console.error('[Cron Error]', {
              type: 'site_audit_failed',
              url: site.url,
              timestamp: new Date().toISOString(),
              error: err.message,
            })
          })
          results.site_audits_started++

          // Update last audit timestamp
          await supabase
            .from('monitored_sites')
            .update({ last_site_audit_at: new Date().toISOString() })
            .eq('id', site.id)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Site audit for ${site.url}: ${errorMessage}`)
      }
    }

    // Run Performance Audit if enabled
    if (site.run_performance_audit) {
      try {
        // Get monitored pages for this org
        const { data: pages } = await supabase
          .from('monitored_pages')
          .select('url')
          .eq('organization_id', site.organization_id)

        const urls = [site.url, ...(pages || []).map((p) => p.url)]

        const { data: audit, error: insertError } = await supabase
          .from('performance_audits')
          .insert({
            organization_id: site.organization_id,
            status: 'pending',
          })
          .select()
          .single()

        if (insertError) {
          results.errors.push(`Performance audit insert for ${site.url}: ${insertError.message}`)
          continue
        }

        if (audit) {
          runPerformanceAudit(audit.id, urls).catch((err) => {
            console.error('[Cron Error]', {
              type: 'performance_audit_failed',
              url: site.url,
              timestamp: new Date().toISOString(),
              error: err.message,
            })
          })
          results.performance_audits_started++

          // Update last audit timestamp
          await supabase
            .from('monitored_sites')
            .update({ last_performance_audit_at: new Date().toISOString() })
            .eq('id', site.id)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Performance audit for ${site.url}: ${errorMessage}`)
      }
    }
  }

  console.log('[Cron Info]', {
    type: 'weekly_audits_completed',
    timestamp: new Date().toISOString(),
    results,
  })

  return NextResponse.json(results)
}
