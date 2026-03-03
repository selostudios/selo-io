import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { UserRole } from '@/lib/permissions'

export async function Header() {
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) {
    redirect('/login')
  }

  const userEmail = user.email || ''
  const firstName = userRecord.first_name || userEmail.split('@')[0]
  const lastName = userRecord.last_name || ''
  const role = userRecord.role || UserRole.TeamMember

  return (
    <header className="flex h-16 items-center justify-end border-b bg-white px-6">
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
