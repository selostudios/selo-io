import { redirect } from 'next/navigation'
import { withSettingsAuth, NoOrgSelected } from '@/lib/auth/settings-auth'
import { createClient } from '@/lib/supabase/server'
import { canManageIntegrations } from '@/lib/permissions'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { OAuthToastHandler } from './oauth-toast-handler'
import { IntegrationsPageContent } from './integrations-page-content'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  // Guard: only users with integrations:manage can access
  const user = await getAuthUser()
  if (user) {
    const record = await getUserRecord(user.id)
    if (!canManageIntegrations(record?.role)) {
      redirect('/settings/team')
    }
  }

  const result = await withSettingsAuth(
    searchParams,
    async (organizationId) => {
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
    },
    'Select an organization to view integrations.'
  )

  if (result.type === 'no-org') {
    return <NoOrgSelected message={result.message} />
  }

  return (
    <>
      <OAuthToastHandler />
      <IntegrationsPageContent connectionsByPlatform={result.data.connectionsByPlatform} />
    </>
  )
}
