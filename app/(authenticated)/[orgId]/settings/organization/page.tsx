import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationForm } from '@/components/settings/organization-form'
import { canManageOrg } from '@/lib/permissions'
import { withSettingsAuth, NoOrgSelected } from '@/lib/auth/settings-auth'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function OrganizationSettingsPage({ searchParams }: PageProps) {
  const result = await withSettingsAuth(
    searchParams,
    async (organizationId, { isInternal, userRecord }) => {
      // Only check permissions for external users
      if (!isInternal && !canManageOrg(userRecord.role)) {
        redirect('/settings/team')
      }

      const supabase = await createClient()

      // Get organization details
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

      // Count existing non-archived audits
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

      return { org, auditCount: auditCount || 0, industries: industries || [] }
    },
    'Select an organization to view settings.'
  )

  if (result.type === 'no-org') {
    return <NoOrgSelected message={result.message} />
  }

  const { org, auditCount, industries } = result.data

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organization Profile</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your organization&apos;s branding and settings
        </p>
      </div>

      <OrganizationForm
        key={org.id}
        organizationId={org.id}
        name={org.name}
        industryId={org.industry || ''}
        logoUrl={org.logo_url || ''}
        primaryColor={org.primary_color}
        secondaryColor={org.secondary_color}
        accentColor={org.accent_color}
        industries={industries}
        websiteUrl={org.website_url || ''}
        existingAuditCount={auditCount}
        description={org.description || ''}
        city={org.city || ''}
        country={org.country || ''}
        socialLinks={org.social_links || []}
      />
    </div>
  )
}
