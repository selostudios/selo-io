import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isInternalUser } from '@/lib/permissions'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { resolveOrganizationId } from '@/lib/auth/resolve-org'
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel'
import { WebsiteUrlToast } from '@/components/audit/website-url-toast'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { org: selectedOrgId } = await searchParams

  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)
  const isInternal = userRecord ? isInternalUser(userRecord) : false
  const organizationId = await resolveOrganizationId(
    selectedOrgId,
    userRecord?.organization_id ?? null,
    isInternal
  )

  if (!userRecord || !organizationId) {
    if (isInternal && !organizationId) {
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Select an organization to view dashboard.</p>
        </div>
      )
    }
    redirect('/onboarding')
  }

  const supabase = await createClient()

  // Fetch org details and connections in parallel
  const [{ data: orgData }, { data: connections }] = await Promise.all([
    supabase.from('organizations').select('name, website_url').eq('id', organizationId).single(),
    supabase
      .from('platform_connections')
      .select('id, platform_type, account_name, display_name, status, last_sync_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true }),
  ])

  // Group connections by platform type
  const linkedInConnections = (connections || []).filter((c) => c.platform_type === 'linkedin')
  const googleAnalyticsConnections = (connections || []).filter(
    (c) => c.platform_type === 'google_analytics'
  )
  const hubspotConnections = (connections || []).filter((c) => c.platform_type === 'hubspot')

  return (
    <div className="space-y-8 p-8">
      <WebsiteUrlToast websiteUrl={orgData?.website_url || null} />

      <IntegrationsPanel
        linkedInConnections={linkedInConnections}
        googleAnalyticsConnections={googleAnalyticsConnections}
        hubspotConnections={hubspotConnections}
      />
    </div>
  )
}
