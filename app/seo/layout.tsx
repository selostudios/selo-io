import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { SeoHeader } from '@/components/seo/seo-header'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
import { isInternalUser } from '@/lib/permissions'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export default async function SeoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has organization and internal status
  const { data: userRecord, error } = await supabase
    .from('users')
    .select('organization_id, is_internal, first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (error || !userRecord?.organization_id) {
    redirect('/onboarding')
  }

  const isInternal = isInternalUser(userRecord)

  // Fetch organizations for selector
  const { data: orgsData } = await supabase
    .from('organizations')
    .select('id, name, website_url, status, logo_url')
    .neq('status', 'inactive')
    .order('name', { ascending: true })

  const organizations: OrganizationForSelector[] = (orgsData || []).map((org) => ({
    id: org.id,
    name: org.name,
    website_url: org.website_url,
    status: org.status,
    logo_url: org.logo_url,
  }))

  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''
  const role = userRecord?.role || 'team_member'

  return (
    <FeedbackProvider>
      <div className="flex min-h-screen bg-neutral-50">
        <NavigationShell isInternal={isInternal} />
        <div className="flex flex-1 flex-col">
          <SeoHeader
            userEmail={userEmail}
            firstName={firstName}
            lastName={lastName}
            role={role}
            organizations={organizations}
            isInternal={isInternal}
          />
          <main className="flex-1">
            <div className="space-y-6 p-8">{children}</div>
          </main>
        </div>
      </div>
      <FeedbackDialog />
      <FeedbackTrigger />
    </FeedbackProvider>
  )
}
