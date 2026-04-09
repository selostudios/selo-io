import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { syncOrganization } from '@/lib/ai-visibility/sync'

export const maxDuration = 300

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all active AI visibility configs with org data
  const { data: configs, error: configsError } = await supabase
    .from('ai_visibility_configs')
    .select('*, organizations!inner(name, website_url)')
    .eq('is_active', true)

  if (configsError) {
    console.error('[AI Visibility Cron]', {
      type: 'configs_fetch_failed',
      error: configsError.message,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 })
  }

  if (!configs?.length) {
    return NextResponse.json({ message: 'No active configs', synced: 0 })
  }

  const results: {
    organizationId: string
    orgName: string
    queriesCompleted: number
    totalCostCents: number
    budgetExceeded: boolean
    errors: number
  }[] = []

  for (const config of configs) {
    const org = (config as Record<string, unknown>).organizations as {
      name: string
      website_url: string | null
    }

    try {
      const syncResult = await syncOrganization({
        organizationId: config.organization_id,
        orgName: org.name,
        websiteUrl: org.website_url,
        config,
      })

      results.push({
        organizationId: config.organization_id,
        orgName: org.name,
        queriesCompleted: syncResult.queriesCompleted,
        totalCostCents: syncResult.totalCostCents,
        budgetExceeded: syncResult.budgetExceeded,
        errors: syncResult.errors.length,
      })

      if (syncResult.errors.length > 0) {
        console.error('[AI Visibility Cron]', {
          type: 'sync_errors',
          organizationId: config.organization_id,
          errors: syncResult.errors,
          timestamp: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('[AI Visibility Cron]', {
        type: 'org_sync_failed',
        organizationId: config.organization_id,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      })

      results.push({
        organizationId: config.organization_id,
        orgName: org.name,
        queriesCompleted: 0,
        totalCostCents: 0,
        budgetExceeded: false,
        errors: 1,
      })
    }
  }

  const totalSynced = results.filter((r) => r.queriesCompleted > 0).length
  const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)

  return NextResponse.json({
    synced: totalSynced,
    total: configs.length,
    totalErrors,
    results,
  })
}
