import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OAuthToastHandler } from './oauth-toast-handler'
import { IntegrationsPageContent } from './integrations-page-content'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const { org: selectedOrgId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/login')
  }

  // Internal users can view any org, external users only their own
  const isInternal = userRecord.is_internal === true
  const organizationId = isInternal && selectedOrgId ? selectedOrgId : userRecord.organization_id

  // For internal users without an org_id, require org selection
  if (!organizationId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Select an organization to view integrations.</p>
      </div>
    )
  }

  const { data: connections } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  const platforms = ['linkedin', 'hubspot', 'google_analytics'] as const

  // Normalize connections to always be an array
  const allConnections = connections || []

  // Group connections by platform type
  const connectionsByPlatform = platforms.reduce(
    (acc, platform) => {
      acc[platform] = allConnections.filter((c) => c.platform_type === platform)
      return acc
    },
    {} as Record<string, typeof allConnections>
  )

  return (
    <>
      <OAuthToastHandler />
      <IntegrationsPageContent connectionsByPlatform={connectionsByPlatform} />
    </>
  )
}
