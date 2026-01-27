import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgSelector } from '@/components/shared/org-selector'
import { getOrganizations } from '@/lib/organizations/actions'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface HeaderProps {
  selectedOrgId?: string | null
}

export async function Header({ selectedOrgId }: HeaderProps = {}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error } = await supabase
    .from('users')
    .select(
      'organization:organizations(id, name, logo_url, website_url, status), first_name, last_name, role, is_internal, organization_id'
    )
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''
  const role = userRecord?.role || 'team_member'
  const isInternal = userRecord?.is_internal === true

  // Fetch all organizations for internal users, or just user's org for external users
  let organizations: OrganizationForSelector[] = []
  if (isInternal) {
    const allOrgs = await getOrganizations()
    organizations = allOrgs.map((org) => ({
      id: org.id,
      name: org.name,
      website_url: org.website_url,
      status: org.status,
      logo_url: org.logo_url,
    }))
  } else {
    // External users: use their organization data
    const userOrg = userRecord?.organization as unknown as {
      id: string
      name: string
      logo_url: string | null
      website_url: string | null
      status: string
    } | null

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
          selectedOrganizationId={selectedOrgId}
        />
      </div>
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
