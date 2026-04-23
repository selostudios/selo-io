import { isInternalUser, canViewFeedback as canViewFeedbackFn, UserRole } from '@/lib/permissions'
import { getOrganizationsList } from '@/lib/auth/cached'
import type { CachedUserRecord } from '@/lib/auth/cached'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { User } from '@supabase/supabase-js'

export interface LayoutData {
  isInternal: boolean
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

  let organizations: OrganizationForSelector[] = []
  if (isInternal) {
    organizations = await getOrganizationsList()
  } else {
    // Non-internal users see every org they're a member of.
    organizations = userRecord.memberships
      .filter((m) => m.organization !== null)
      .map((m) => ({
        id: m.organization!.id,
        name: m.organization!.name,
        website_url: m.organization!.website_url,
        status: m.organization!.status as OrganizationForSelector['status'],
        logo_url: m.organization!.logo_url,
      }))
  }

  const userEmail = user.email || ''
  const firstName = userRecord.first_name || userEmail.split('@')[0]
  const lastName = userRecord.last_name || ''
  const role = userRecord.role || UserRole.TeamMember

  return {
    isInternal,
    organizations,
    userEmail,
    firstName,
    lastName,
    role,
    userRole: userRecord.role,
    canViewFeedback: canViewFeedbackFn(userRecord.role),
  }
}
