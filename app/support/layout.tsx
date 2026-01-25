import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { HeaderMinimal } from '@/components/dashboard/header-minimal'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
import { canManageFeedback, isInternalUser } from '@/lib/permissions'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has permissions and internal status
  const { data: userRecord } = await supabase
    .from('users')
    .select('role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageFeedback(userRecord.role)) {
    redirect('/dashboard')
  }

  const isInternal = isInternalUser(userRecord.is_internal)

  return (
    <FeedbackProvider>
      <div className="flex min-h-screen bg-neutral-50">
        <NavigationShell isInternal={isInternal} />
        <div className="flex flex-1 flex-col">
          <HeaderMinimal />
          <main className="flex-1">
            <div className="space-y-6 p-8">{children}</div>
          </main>
        </div>
      </div>
      <FeedbackDialog />
      <FeedbackTrigger />
    </FeedbackProvider>
  )
}
