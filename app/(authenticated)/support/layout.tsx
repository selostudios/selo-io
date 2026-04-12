import { redirect } from 'next/navigation'
import { canViewFeedback } from '@/lib/permissions'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)

  if (!userRecord || !canViewFeedback(userRecord.role)) {
    redirect('/dashboard')
  }

  return <div className="space-y-6 p-8">{children}</div>
}
