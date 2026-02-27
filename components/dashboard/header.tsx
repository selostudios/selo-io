import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgSelector } from '@/components/shared/org-selector'
import { getAuthUser, getUserRecord, getOrganizationsList } from '@/lib/auth/cached'
import { resolveOrganizationId } from '@/lib/auth/resolve-org'
import { isInternalUser, UserRole } from '@/lib/permissions'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export async function Header() {
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) {
    redirect('/login')
  }

  const userEmail = user.email || ''
  const firstName = userRecord.first_name || userEmail.split('@')[0]
  const lastName = userRecord.last_name || ''
  const role = userRecord.role || UserRole.TeamMember
  const isInternal = isInternalUser(userRecord)

  // Resolve org from cookie for server-side pre-selection
  const resolvedOrgId = await resolveOrganizationId(
    undefined,
    userRecord.organization_id,
    isInternal
  )

  // Fetch organizations for the selector
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

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        <OrgSelector
          organizations={organizations}
          isInternal={isInternal}
          selectedOrganizationId={resolvedOrgId}
        />
      </div>
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
