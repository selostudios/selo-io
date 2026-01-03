import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationForm } from '@/components/settings/organization-form'

export default async function OrganizationSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

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
    redirect('/dashboard/settings/team')
  }

  // Get organization details
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', userRecord.organization_id)
    .single()

  if (!org) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organization Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organization's branding and settings
        </p>
      </div>

      <OrganizationForm
        organizationId={org.id}
        name={org.name}
        industry={org.industry || ''}
        logoUrl={org.logo_url || ''}
        primaryColor={org.primary_color}
        secondaryColor={org.secondary_color}
        accentColor={org.accent_color}
      />
    </div>
  )
}
