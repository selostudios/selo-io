import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has organization
  const { data: userRecord, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (error || !userRecord?.organization_id) {
    redirect('/onboarding')
  }

  // Get organization's website URL for sidebar
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar websiteUrl={org?.website_url ?? null} />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1">
          <div className="space-y-6 p-8">
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <p className="text-muted-foreground mt-2">Manage your personal information</p>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
