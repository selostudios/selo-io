import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/settings/profile-form'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's name
  const { data: userRecord } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <ProfileForm
        email={user.email || ''}
        name={userRecord?.name || ''}
      />
    </div>
  )
}
