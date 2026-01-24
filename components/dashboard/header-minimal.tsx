import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'

export async function HeaderMinimal() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error } = await supabase
    .from('users')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''
  const role = userRecord?.role || 'team_member'

  return (
    <header className="flex h-16 items-center justify-end border-b bg-white px-6">
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
