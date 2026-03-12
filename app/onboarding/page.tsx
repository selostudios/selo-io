import { CreateOrganizationForm } from '@/components/onboarding/create-organization-form'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Check if user already has an organization (via team_members)
  const { data: membership } = await supabase
    .from('team_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membership?.organization_id) {
    redirect('/dashboard')
  }

  // Fetch industries
  const { data: industries } = await supabase
    .from('industries')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <CreateOrganizationForm industries={industries || []} />
    </div>
  )
}
