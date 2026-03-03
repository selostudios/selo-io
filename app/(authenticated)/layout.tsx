import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { resolveLayoutData } from '@/lib/auth/resolve-layout-data'

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)

  if (!userRecord?.organization_id) {
    redirect('/onboarding')
  }

  const data = await resolveLayoutData(user, userRecord)

  return <AppShell {...data}>{children}</AppShell>
}
