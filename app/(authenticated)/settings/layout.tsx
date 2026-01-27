import { SettingsTabs } from '@/components/settings/settings-tabs'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and organization preferences
        </p>
      </div>

      <SettingsTabs />

      {children}
    </div>
  )
}
