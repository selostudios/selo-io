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

  const { data: userRow } = await supabase
    .from('users')
    .select('is_internal, team_members(organization_id)')
    .eq('id', user.id)
    .single()

  const memberships = ((userRow?.team_members as { organization_id: string }[]) ?? []).map(
    (m) => m.organization_id
  )
  const isInternal = userRow?.is_internal === true

  // Trust the cookie only if it points to an org the user can actually access.
  // Internal users can land in any org; everyone else must have a team_members row.
  const cookieStore = await cookies()
  const cookieOrgId = cookieStore.get(SELO_ORG_COOKIE)?.value
  if (cookieOrgId && (isInternal || memberships.includes(cookieOrgId))) {
    redirect(`/${cookieOrgId}/dashboard`)
  }

  if (memberships[0]) {
    redirect(`/${memberships[0]}/dashboard`)
  }

  // No membership — internal users go to the org picker; others go to onboarding.
  redirect(isInternal ? '/organizations' : '/onboarding')
}
