import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'
import { resolveOrganizationId } from '@/lib/auth/resolve-org'

export interface SettingsAuthContext {
  organizationId: string
  isInternal: boolean
  userRecord: {
    organization_id: string | null
    role: string
    is_internal: boolean | null
  }
}

export type SettingsAuthResult<T> =
  | { type: 'success'; context: SettingsAuthContext; data: T }
  | { type: 'no-org'; message: string }

/**
 * Shared auth logic for settings pages.
 * Handles user auth, internal user org selection, and permission checks.
 */
export async function withSettingsAuth<T>(
  searchParams: Promise<{ org?: string }>,
  getData: (organizationId: string, context: SettingsAuthContext) => Promise<T>,
  noOrgMessage: string = 'Select an organization to view settings.'
): Promise<SettingsAuthResult<T>> {
  const { org: selectedOrgId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: rawUser } = await supabase
    .from('users')
    .select('organization_id, role, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  if (!rawUser) {
    redirect('/onboarding')
  }

  // Prefer team_members data, fall back to users columns (backward compat)
  const membership = (rawUser.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = {
    organization_id: membership?.organization_id ?? rawUser.organization_id,
    role: membership?.role ?? rawUser.role,
    is_internal: rawUser.is_internal,
  }

  const isInternal = isInternalUser(userRecord)
  const organizationId = await resolveOrganizationId(
    selectedOrgId,
    userRecord.organization_id,
    isInternal
  )

  if (!organizationId) {
    return { type: 'no-org', message: noOrgMessage }
  }

  const context: SettingsAuthContext = {
    organizationId,
    isInternal,
    userRecord,
  }

  const data = await getData(organizationId, context)

  return { type: 'success', context, data }
}

/**
 * Component to render when no organization is selected.
 */
export function NoOrgSelected({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
