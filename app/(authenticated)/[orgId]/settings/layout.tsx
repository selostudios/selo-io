import { redirect } from 'next/navigation'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and organization preferences
        </p>
      </div>

      <SettingsTabs userRole={userRecord?.role} />

      {children}
    </div>
  )
}
