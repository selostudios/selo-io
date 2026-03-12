import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'
import { getInternalEmployees } from './actions'
import { TeamClient } from './client'

export default async function AppSettingsTeamPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord || !isInternalUser(userRecord)) redirect('/dashboard')

  const employees = await getInternalEmployees()
  if ('error' in employees) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load employees: {employees.error}</p>
      </div>
    )
  }

  const isAdmin = userRecord.role === 'admin'

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Internal Team</h1>
          <p className="text-muted-foreground mt-1">
            Manage Selo internal employees and their access.
          </p>
        </div>
      </div>
      <TeamClient employees={employees} isAdmin={isAdmin} currentUserId={user.id} />
    </div>
  )
}
