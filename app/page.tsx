import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SELO_ORG_COOKIE } from '@/lib/constants/org-storage'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check selo-org cookie first for fast redirect
  const cookieStore = await cookies()
  const cookieOrgId = cookieStore.get(SELO_ORG_COOKIE)?.value
  if (cookieOrgId) {
    redirect(`/${cookieOrgId}/dashboard`)
  }

  // Fall back to team membership
  const { data: membership } = await supabase
    .from('team_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (membership?.organization_id) {
    redirect(`/${membership.organization_id}/dashboard`)
  }

  // No org — send to organizations page to create/pick one
  redirect('/organizations')
}
