import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { canViewFeedback } from '@/lib/permissions'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { resolveLayoutData } from '@/lib/auth/resolve-layout-data'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)

  if (!userRecord || !canViewFeedback(userRecord.role)) {
    redirect('/dashboard')
  }

  const data = await resolveLayoutData(user, userRecord)

  return (
    <AppShell {...data}>
      <div className="space-y-6 p-8">{children}</div>
    </AppShell>
  )
}
