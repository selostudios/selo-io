import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfilePageForm } from './profile-page-form'
import { UserRole } from '@/lib/enums'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's name and role
  const { data: rawUser } = await supabase
    .from('users')
    .select('first_name, last_name, team_members(role)')
    .eq('id', user.id)
    .single()

  const profileRole = (rawUser?.team_members as { role: string }[])?.[0]?.role

  return (
    <div className="space-y-6">
      <ProfilePageForm
        email={user.email || ''}
        firstName={rawUser?.first_name || ''}
        lastName={rawUser?.last_name || ''}
        role={profileRole || UserRole.TeamMember}
      />
    </div>
  )
}
