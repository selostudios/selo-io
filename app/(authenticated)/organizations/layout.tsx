import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'
import { SELO_ORG_COOKIE } from '@/lib/constants/org-storage'
import { cookies } from 'next/headers'

export default async function OrganizationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is internal
  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  // Internal users can always access organizations management
  if (userRecord && isInternalUser(userRecord)) {
    return <>{children}</>
  }

  // Non-internal users: if they have an org, redirect them there
  const cookieStore = await cookies()
  const cookieOrgId = cookieStore.get(SELO_ORG_COOKIE)?.value
  if (cookieOrgId) {
    redirect(`/${cookieOrgId}/dashboard`)
  }

  // Check team membership as fallback
  const { data: membership } = await supabase
    .from('team_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membership?.organization_id) {
    redirect(`/${membership.organization_id}/dashboard`)
  }

  // No org — send to onboarding to create one
  redirect('/onboarding')
}
