'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'

export async function getPageSpeedData(): Promise<{
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  organizationId: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) redirect('/login')

  // Get audits for organization
  const { data: audits, error: auditsError } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (auditsError) {
    console.error('[Performance Error]', {
      type: 'fetch_audits_failed',
      timestamp: new Date().toISOString(),
      error: auditsError.message,
    })
  }

  // Get monitored pages
  const { data: monitoredPages, error: pagesError } = await supabase
    .from('monitored_pages')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  if (pagesError) {
    console.error('[Performance Error]', {
      type: 'fetch_pages_failed',
      timestamp: new Date().toISOString(),
      error: pagesError.message,
    })
  }

  return {
    audits: audits ?? [],
    monitoredPages: monitoredPages ?? [],
    organizationId: userRecord.organization_id,
  }
}
