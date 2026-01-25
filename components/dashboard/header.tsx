import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgLogo } from '@/components/dashboard/org-logo'
import { OrganizationSelector } from './organization-selector'
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
      'organization:organizations(name, logo_url, primary_color), first_name, last_name, role, is_internal'
    )
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const org = userRecord?.organization as unknown as {
    name: string
    logo_url: string | null
    primary_color: string | null
  } | null
  const orgName = org?.name || 'Organization'
  const logoUrl = org?.logo_url || null
  const primaryColor = org?.primary_color || null
  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''
  const role = userRecord?.role || 'team_member'
  const isInternal = userRecord?.is_internal === true

  // Fetch all organizations for internal users
  let organizations: OrganizationForSelector[] = []
  if (isInternal) {
    const allOrgs = await getOrganizations()
    organizations = allOrgs.map((org) => ({
      id: org.id,
      name: org.name,
      website_url: org.website_url,
      status: org.status,
    }))
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        {isInternal ? (
          <OrganizationSelector
            organizations={organizations}
            selectedOrganizationId={selectedOrgId}
          />
        ) : (
          <>
            <OrgLogo logoUrl={logoUrl} orgName={orgName} primaryColor={primaryColor} size={40} />
            <h2 className="text-lg font-semibold">{orgName}</h2>
          </>
        )}
      </div>
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
