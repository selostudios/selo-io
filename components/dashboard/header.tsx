import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'

export async function Header() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error } = await supabase
    .from('users')
    .select('organization:organizations(name), name')
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const orgName = (userRecord?.organization as unknown as { name: string } | null)?.name || 'Organization'
  const userEmail = user?.email || ''
  const userName = userRecord?.name || userEmail.split('@')[0]
  const initials = userName.length >= 2 ? userName.substring(0, 2).toUpperCase() : 'U'

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold">{orgName}</h2>
      </div>
      <UserMenu userEmail={userEmail} userName={userName} initials={initials} />
    </header>
  )
}
