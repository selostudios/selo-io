import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'

export interface SettingsAuthContext {
  organizationId: string
  isInternal: boolean
  userRecord: {
    organization_id: string | null
    role: string
    is_internal: boolean | null
  }
}

export type SettingsAuthResult<T> = { type: 'success'; context: SettingsAuthContext; data: T }

/**
 * Shared auth logic for settings pages.
 * Handles user auth and permission checks.
 * Organization ID is already validated by the [orgId] layout.
 */
export async function withSettingsAuth<T>(
  orgId: string,
  getData: (organizationId: string, context: SettingsAuthContext) => Promise<T>
): Promise<SettingsAuthResult<T>> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rawUser } = await supabase
    .from('users')
    .select('is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  if (!rawUser) {
    redirect('/onboarding')
  }

  const membership = (rawUser.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = {
    organization_id: membership?.organization_id ?? null,
    role: membership?.role ?? 'client_viewer',
    is_internal: rawUser.is_internal,
  }

  const isInternal = isInternalUser(userRecord)

  const context: SettingsAuthContext = {
    organizationId: orgId,
    isInternal,
    userRecord,
  }

  const data = await getData(orgId, context)

  return { type: 'success', context, data }
}
