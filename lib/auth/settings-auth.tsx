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

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/onboarding')
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
