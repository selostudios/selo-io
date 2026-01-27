import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationForm } from '@/components/settings/organization-form'
import { canManageOrg, isInternalUser } from '@/lib/permissions'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function OrganizationSettingsPage({ searchParams }: PageProps) {
  const { org: selectedOrgId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's organization and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/onboarding')
  }

  // Internal users can view any org, external users only their own
  const isInternal = isInternalUser(userRecord)
  const organizationId = isInternal && selectedOrgId ? selectedOrgId : userRecord.organization_id

  // For internal users without an org_id, require org selection
  if (!organizationId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Select an organization to view settings.</p>
      </div>
    )
  }

  // Only check permissions for external users
  if (!isInternal && !canManageOrg(userRecord.role)) {
    redirect('/settings/team')
  }

  // Get organization details with industry relationship
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, industry, logo_url, primary_color, secondary_color, accent_color, website_url, description, city, country, social_links'
    )
    .eq('id', organizationId)
    .single()

  if (!org) {
    redirect('/dashboard')
  }

  // Count existing non-archived audits for this organization
  const { count: auditCount } = await supabase
    .from('site_audits')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('archived_at', null)

  // Fetch industries
  const { data: industries } = await supabase
    .from('industries')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organization Profile</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your organization&apos;s branding and settings
        </p>
      </div>

      <OrganizationForm
        organizationId={org.id}
        name={org.name}
        industryId={org.industry || ''}
        logoUrl={org.logo_url || ''}
        primaryColor={org.primary_color}
        secondaryColor={org.secondary_color}
        accentColor={org.accent_color}
        industries={industries || []}
        websiteUrl={org.website_url || ''}
        existingAuditCount={auditCount || 0}
        description={org.description || ''}
        city={org.city || ''}
        country={org.country || ''}
        socialLinks={org.social_links || []}
      />
    </div>
  )
}
