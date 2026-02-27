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
  const { data: userRecord } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <ProfilePageForm
        email={user.email || ''}
        firstName={userRecord?.first_name || ''}
        lastName={userRecord?.last_name || ''}
        role={userRecord?.role || UserRole.TeamMember}
      />
    </div>
  )
}
