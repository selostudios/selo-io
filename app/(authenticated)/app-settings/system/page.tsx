import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'
import { getSystemHealth, getUsageSummary } from './actions'
import { SystemClient } from './client'

export default async function AppSettingsSystemPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord || !isInternalUser(userRecord)) redirect('/dashboard')

  const [health, usage] = await Promise.all([getSystemHealth(), getUsageSummary('month')])

  const healthData = 'error' in health ? [] : health
  const usageData = 'error' in usage ? { totals: [], byOrganization: [] } : usage

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">System</h1>
        <p className="text-muted-foreground mt-1">Service health and API usage overview.</p>
      </div>
      <SystemClient health={healthData} initialUsage={usageData} />
    </div>
  )
}
