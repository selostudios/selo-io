'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getOrganizations } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import type { SiteAudit } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export async function getSiteAuditData(organizationId?: string): Promise<{
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
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
    .from('site_audits')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Filter by organization if we have one
  if (filterOrgId) {
    auditsQuery = auditsQuery.eq('organization_id', filterOrgId)
  }

  const { data: audits } = await auditsQuery

  // Build archived audits query
  let archivedQuery = supabase
    .from('site_audits')
    .select('*')
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    archivedQuery = archivedQuery.eq('organization_id', filterOrgId)
  }

  const { data: archivedAudits } = await archivedQuery

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
    audits: (audits ?? []) as SiteAudit[],
    archivedAudits: (archivedAudits ?? []) as SiteAudit[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}
