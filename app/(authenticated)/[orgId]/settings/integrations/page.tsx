import { redirect } from 'next/navigation'
import { withSettingsAuth } from '@/lib/auth/settings-auth'
import { createClient } from '@/lib/supabase/server'
import { canManageIntegrations } from '@/lib/permissions'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { OAuthToastHandler } from './oauth-toast-handler'
import { IntegrationsPageContent } from './integrations-page-content'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function IntegrationsPage({ params }: PageProps) {
  const { orgId } = await params

  // Guard: only users with integrations:manage can access
  const user = await getAuthUser()
  if (user) {
    const record = await getUserRecord(user.id)
    if (!canManageIntegrations(record?.role)) {
      redirect('/settings/team')
    }
  }

  const result = await withSettingsAuth(orgId, async (organizationId) => {
      const supabase = await createClient()
      const { data: connections } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      const platforms = ['linkedin', 'hubspot', 'google_analytics'] as const
      const allConnections = connections || []

      const connectionsByPlatform = platforms.reduce(
        (acc, platform) => {
          acc[platform] = allConnections.filter((c) => c.platform_type === platform)
          return acc
        },
        {} as Record<string, typeof allConnections>
      )

      return { connectionsByPlatform }
    }
  )

  return (
    <>
      <OAuthToastHandler />
      <IntegrationsPageContent connectionsByPlatform={result.data.connectionsByPlatform} />
    </>
  )
}
