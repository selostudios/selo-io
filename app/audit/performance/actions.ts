'use server'

import { createClient } from '@/lib/supabase/server'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'

export async function getPerformanceData(): Promise<{
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  websiteUrl: string | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { audits: [], monitoredPages: [], websiteUrl: null }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return { audits: [], monitoredPages: [], websiteUrl: null }
  }

  // Get organization website URL
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Get audits
  const { data: audits } = await supabase
    .from('performance_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get monitored pages
  const { data: monitoredPages } = await supabase
    .from('monitored_pages')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  return {
    audits: audits || [],
    monitoredPages: monitoredPages || [],
    websiteUrl: org?.website_url || null,
  }
}
