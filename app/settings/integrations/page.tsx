import { createClient } from '@/lib/supabase/server'
import { PlatformConnectionCard } from '@/components/settings/platform-connection-card'
import { redirect } from 'next/navigation'

export default async function IntegrationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/login')
  }

  const { data: connections } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('organization_id', userRecord.organization_id)

  const platforms = ['hubspot', 'google_analytics', 'linkedin']

  const connectionsMap = new Map(connections?.map((c) => [c.platform_type, c]) || [])

  return (
    <div className="space-y-6">
      <div className="rounded border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Platform connection UI is placeholder for MVP. In production, this
          will include OAuth flows and credential input forms.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold">Platform Integrations</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your marketing platforms to track campaign performance
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {platforms.map((platform) => (
          <PlatformConnectionCard
            key={platform}
            connection={connectionsMap.get(platform) || null}
            platformType={platform}
          />
        ))}
      </div>
    </div>
  )
}
