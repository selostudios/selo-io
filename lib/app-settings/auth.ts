import { createClient } from '@/lib/supabase/server'
import { isInternalUser } from '@/lib/permissions'

export async function requireInternalUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { error: 'Not authenticated' as const, user: null, supabase: null, userRecord: null }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  if (!rawUser)
    return { error: 'User not found' as const, user: null, supabase: null, userRecord: null }

  const membership = (rawUser.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = {
    id: rawUser.id,
    organization_id: membership?.organization_id ?? null,
    role: membership?.role ?? 'client_viewer',
    is_internal: rawUser.is_internal,
  }

  if (!isInternalUser(userRecord)) {
    return { error: 'Not authorized' as const, user: null, supabase: null, userRecord: null }
  }

  return { error: null, user, supabase, userRecord }
}
