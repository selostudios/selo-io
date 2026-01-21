import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationForm } from '@/components/settings/organization-form'

export default async function OrganizationSettingsPage() {
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
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/onboarding')
  }

  const isAdmin = userRecord.role === 'admin'

  if (!isAdmin) {
    redirect('/settings/team')
  }

  // Get organization details with industry relationship
  const { data: org } = await supabase
    .from('organizations')
    .select(
      'id, name, industry, logo_url, primary_color, secondary_color, accent_color, website_url'
    )
    .eq('id', userRecord.organization_id)
    .single()

  if (!org) {
    redirect('/dashboard')
  }

  // Count existing non-archived audits for this organization
  const { count: auditCount } = await supabase
    .from('site_audits')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', userRecord.organization_id)
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
      />
    </div>
  )
}
