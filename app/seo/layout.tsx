import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { Header } from '@/components/dashboard/header'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <FeedbackProvider>
      <div className="flex min-h-screen bg-neutral-50">
        <NavigationShell />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1">
            <div className="space-y-6 p-8">
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
