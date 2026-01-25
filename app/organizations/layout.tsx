import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { Header } from '@/components/dashboard/header'
import { isInternalUser } from '@/lib/permissions'

export default async function OrganizationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is internal
  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  // Only internal users can access organizations management
  if (!isInternalUser(userRecord?.is_internal)) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <NavigationShell isInternal={true} />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
