import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { Header } from '@/components/dashboard/header'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
import { isInternalUser } from '@/lib/permissions'
import { getAuthUser, getUserRecord, getOrganizationsList } from '@/lib/auth/cached'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)

  if (!userRecord?.organization_id) {
    redirect('/onboarding')
  }

  const isInternal = isInternalUser(userRecord)

  // Warm the organizations cache for internal users (Header will hit this same cache)
  if (isInternal) {
    getOrganizationsList()
  }

  return (
    <FeedbackProvider>
      <div className="flex min-h-screen bg-neutral-50">
        <NavigationShell isInternal={isInternal} />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1">{children}</main>
        </div>
      </div>
      <FeedbackDialog />
      <FeedbackTrigger />
    </FeedbackProvider>
  )
}
