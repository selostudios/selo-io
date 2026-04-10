import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { getAppSettings } from './actions'
import { IntegrationsClient } from './client'

export default async function AppSettingsIntegrationsPage() {
  const user = await getAuthUser()
  const userRecord = await getUserRecord(user!.id)
  const isAdmin = userRecord?.role === 'admin' || (userRecord != null && isInternalUser(userRecord))

  const settings = await getAppSettings()
  if ('error' in settings) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load settings: {settings.error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">App Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys and credentials for platform services.
        </p>
      </div>
      <IntegrationsClient settings={settings} isAdmin={isAdmin} />
    </div>
  )
}
