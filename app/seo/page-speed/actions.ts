'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getOrganizations } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export async function getPageSpeedData(organizationId?: string): Promise<{
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}> {
  const supabase = await createClient()

  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser

  // Determine the filter organization:
  // - For internal users: use provided org or null (see all)
  // - For external users: always use their own org
  const filterOrgId = isInternal ? organizationId || null : userOrgId

  // Build audits query
  let auditsQuery = supabase
    .from('performance_audits')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  // Filter by organization if we have one
  if (filterOrgId) {
    auditsQuery = auditsQuery.eq('organization_id', filterOrgId)
  }

  const { data: audits, error: auditsError } = await auditsQuery

  if (auditsError) {
    console.error('[Performance Error]', {
      type: 'fetch_audits_failed',
      timestamp: new Date().toISOString(),
      error: auditsError.message,
    })
  }

  // Build monitored pages query
  let pagesQuery = supabase
    .from('monitored_pages')
    .select('*')
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    pagesQuery = pagesQuery.eq('organization_id', filterOrgId)
  }

  const { data: monitoredPages, error: pagesError } = await pagesQuery

  if (pagesError) {
    console.error('[Performance Error]', {
      type: 'fetch_pages_failed',
      timestamp: new Date().toISOString(),
      error: pagesError.message,
    })
  }

  // Get organizations for selector
  const orgs = await getOrganizations()
  const organizations: OrganizationForSelector[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    website_url: org.website_url,
    status: org.status,
  }))

  return {
    audits: (audits ?? []) as PerformanceAudit[],
    monitoredPages: (monitoredPages ?? []) as MonitoredPage[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}
