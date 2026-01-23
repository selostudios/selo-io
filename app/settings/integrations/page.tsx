import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OAuthToastHandler } from './oauth-toast-handler'
import { IntegrationsPageContent } from './integrations-page-content'

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
    .order('created_at', { ascending: true })

  const platforms = ['linkedin', 'hubspot', 'google_analytics'] as const

  // Group connections by platform type
  const connectionsByPlatform = platforms.reduce(
    (acc, platform) => {
      acc[platform] = (connections || []).filter((c) => c.platform_type === platform)
      return acc
    },
    {} as Record<string, typeof connections>
  )

  return (
    <>
      <OAuthToastHandler />
      <IntegrationsPageContent connectionsByPlatform={connectionsByPlatform} />
    </>
  )
}
