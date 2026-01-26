import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { Header } from '@/components/dashboard/header'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
import { isInternalUser } from '@/lib/permissions'

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has organization and internal status
  const { data: userRecord, error } = await supabase
    .from('users')
    .select('organization_id, is_internal')
    .eq('id', user.id)
    .single()

  if (error || !userRecord?.organization_id) {
    redirect('/onboarding')
  }

  const isInternal = isInternalUser(userRecord)

  return (
    <FeedbackProvider>
      <div className="flex min-h-screen bg-neutral-50">
        <NavigationShell isInternal={isInternal} />
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
      <FeedbackDialog />
      <FeedbackTrigger />
    </FeedbackProvider>
  )
}
