import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'

export default async function AppSettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord || !isInternalUser(userRecord)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
