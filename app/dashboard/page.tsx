import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IntegrationsPanel } from '@/components/dashboard/integrations-panel'
import { WebsiteUrlToast } from '@/components/audit/website-url-toast'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { org: selectedOrgId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('organization:organizations(name), organization_id, is_internal')
    .eq('id', user.id)
    .single()

  // Internal users can view any org, external users only their own
  const isInternal = userRecord?.is_internal === true
  const organizationId = isInternal && selectedOrgId ? selectedOrgId : userRecord?.organization_id

  if (userError || !userRecord || !organizationId) {
    if (isInternal && !selectedOrgId) {
      // Internal user without org selected - show prompt
      return (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Select an organization to view dashboard.</p>
        </div>
      )
    }
    redirect('/onboarding')
  }

  // Get organization's details
  const { data: orgData } = await supabase
    .from('organizations')
    .select('name, website_url')
    .eq('id', organizationId)
    .single()

  // Get all platform connections for this organization
  const { data: connections } = await supabase
    .from('platform_connections')
    .select('id, platform_type, account_name, display_name, status, last_sync_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  // Group connections by platform type
  const linkedInConnections = (connections || []).filter((c) => c.platform_type === 'linkedin')
  const googleAnalyticsConnections = (connections || []).filter(
    (c) => c.platform_type === 'google_analytics'
  )
  const hubspotConnections = (connections || []).filter((c) => c.platform_type === 'hubspot')

  return (
    <div className="space-y-8 p-8">
      <WebsiteUrlToast websiteUrl={orgData?.website_url || null} />
      <div>
        <h1 className="text-3xl font-bold">
          Welcome to {orgData?.name || 'Selo IO'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your marketing performance across all platforms
        </p>
      </div>

      <IntegrationsPanel
        linkedInConnections={linkedInConnections}
        googleAnalyticsConnections={googleAnalyticsConnections}
        hubspotConnections={hubspotConnections}
      />
    </div>
  )
}
