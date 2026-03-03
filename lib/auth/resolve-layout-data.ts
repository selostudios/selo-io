import { isInternalUser, canViewFeedback as canViewFeedbackFn, UserRole } from '@/lib/permissions'
import { getOrganizationsList } from '@/lib/auth/cached'
import type { CachedUserRecord } from '@/lib/auth/cached'
import { resolveOrganizationId } from '@/lib/auth/resolve-org'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { User } from '@supabase/supabase-js'

export interface LayoutData {
  isInternal: boolean
  resolvedOrgId: string | null
  organizations: OrganizationForSelector[]
  userEmail: string
  firstName: string
  lastName: string
  role: string
  userRole: string
  canViewFeedback: boolean
}

/**
 * Resolve all common data needed by the app shell (header, sidebar, user menu).
 * Called by both the authenticated and support layouts after their auth guards.
 */
export async function resolveLayoutData(
  user: User,
  userRecord: CachedUserRecord
): Promise<LayoutData> {
  const isInternal = isInternalUser(userRecord)

  const resolvedOrgId = await resolveOrganizationId(
    undefined,
    userRecord.organization_id,
    isInternal
  )

  let organizations: OrganizationForSelector[] = []
  if (isInternal) {
    organizations = await getOrganizationsList()
  } else {
    const userOrg = userRecord.organization
    if (userOrg) {
      organizations = [
        {
          id: userOrg.id,
          name: userOrg.name,
          website_url: userOrg.website_url,
          status: userOrg.status as OrganizationForSelector['status'],
          logo_url: userOrg.logo_url,
        },
      ]
    }
  }

  const userEmail = user.email || ''
  const firstName = userRecord.first_name || userEmail.split('@')[0]
  const lastName = userRecord.last_name || ''
  const role = userRecord.role || UserRole.TeamMember

  return {
    isInternal,
    resolvedOrgId,
    organizations,
    userEmail,
    firstName,
    lastName,
    role,
    userRole: userRecord.role,
    canViewFeedback: canViewFeedbackFn(userRecord.role),
  }
}
