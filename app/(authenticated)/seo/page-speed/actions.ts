'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getOrganizations } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import type { PerformanceAudit } from '@/lib/performance/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export async function getPageSpeedData(organizationId?: string): Promise<{
  audits: PerformanceAudit[]
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
    .select(
      'id, organization_id, created_by, status, error_message, started_at, completed_at, created_at, current_url, current_device, total_urls, completed_count'
    )
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

  // For one-time audits (organization_id = null), fetch the first URL from results
  const oneTimeAuditIds = (audits ?? [])
    .filter((audit) => audit.organization_id === null)
    .map((audit) => audit.id)

  let firstUrlsMap: Record<string, string> = {}

  if (oneTimeAuditIds.length > 0) {
    // Fetch first URL for each one-time audit in a single query
    const { data: firstUrls } = await supabase
      .from('performance_audit_results')
      .select('audit_id, url')
      .in('audit_id', oneTimeAuditIds)
      .order('created_at', { ascending: true })

    // Create a map of audit_id to first URL
    if (firstUrls) {
      firstUrlsMap = firstUrls.reduce(
        (acc, result) => {
          if (!acc[result.audit_id]) {
            acc[result.audit_id] = result.url
          }
          return acc
        },
        {} as Record<string, string>
      )
    }
  }

  // Add first_url to one-time audits
  const auditsWithUrls = (audits ?? []).map((audit) => {
    if (audit.organization_id === null && firstUrlsMap[audit.id]) {
      return {
        ...audit,
        first_url: firstUrlsMap[audit.id],
      }
    }
    return audit
  })

  // Get organizations for selector
  const orgs = await getOrganizations()
  const organizations: OrganizationForSelector[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    website_url: org.website_url,
    status: org.status,
    logo_url: org.logo_url,
  }))

  return {
    audits: auditsWithUrls as PerformanceAudit[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}
