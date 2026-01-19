import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonitoredSitesManager } from '@/components/settings/monitored-sites'

export default async function MonitoringSettingsPage() {
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

  // Get organization website URL
  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Get monitored sites
  const { data: sites } = await supabase
    .from('monitored_sites')
    .select('*')
    .eq('organization_id', userRecord.organization_id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Monitoring Settings</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure automated monitoring for your website
        </p>
      </div>
      <MonitoredSitesManager sites={sites ?? []} websiteUrl={org?.website_url ?? null} />
    </div>
  )
}
