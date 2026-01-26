import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export async function getGEOAuditData(organizationId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization, internal status, and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    throw new Error('User not found')
  }

  const isInternal = userRecord.is_internal === true

  // Fetch organizations for selector (internal users only)
  let organizations: OrganizationForSelector[] = []
  if (isInternal && canAccessAllAudits({ is_internal: isInternal, role: userRecord.role })) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, website_url, status, logo_url')
      .order('name')

    organizations = orgs ?? []
  } else if (userRecord.organization_id) {
    // External users see only their organization
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, website_url, status, logo_url')
      .eq('id', userRecord.organization_id)
      .single()

    if (org) {
      organizations = [org]
    }
  }

  // Determine selected organization
  let selectedOrganizationId: string | null = null
  if (organizationId) {
    // URL param takes precedence
    selectedOrganizationId = organizationId
  } else if (!isInternal && userRecord.organization_id) {
    // External users always use their organization
    selectedOrganizationId = userRecord.organization_id
  }

  return {
    organizations,
    isInternal,
    selectedOrganizationId,
  }
}
