import { createClient } from '@/lib/supabase/server'
import { PlatformConnectionCard } from '@/components/settings/platform-connection-card'

export default async function IntegrationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const { data: connections } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('organization_id', userRecord!.organization_id)

  const platforms = ['hubspot', 'google_analytics', 'linkedin', 'meta', 'instagram']

  const connectionsMap = new Map(
    connections?.map(c => [c.platform_type, c]) || []
  )

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Platform Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your marketing platforms to track campaign performance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((platform) => (
          <PlatformConnectionCard
            key={platform}
            connection={connectionsMap.get(platform) || null}
            platformType={platform}
          />
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Platform connection UI is placeholder for MVP.
          In production, this will include OAuth flows and credential input forms.
        </p>
      </div>
    </div>
  )
}
