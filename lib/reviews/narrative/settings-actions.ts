'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { NARRATIVE_BLOCK_KEYS, type NarrativeBlockKey } from './prompts'
import { filterPromptOverrides, type PromptOverrides } from './overrides'

type ActionOk = { success: true }
type ActionErr = { success: false; error: string }

async function authorizeAdminOrInternal(
  organizationId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getAuthUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) return { ok: false, error: 'User not found' }

  const internal = isInternalUser(userRecord)
  const isOrgAdmin =
    userRecord.organization_id === organizationId && userRecord.role === UserRole.Admin

  if (!internal && !isOrgAdmin) {
    return { ok: false, error: 'Insufficient permissions' }
  }

  return { ok: true, userId: user.id }
}

export async function savePromptOverrides(
  organizationId: string,
  overrides: PromptOverrides
): Promise<ActionOk | ActionErr> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const filtered = filterPromptOverrides(overrides)
  const supabase = await createClient()

  const { error } = await supabase.from('marketing_review_prompt_overrides').upsert(
    {
      organization_id: organizationId,
      prompts: filtered,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    },
    { onConflict: 'organization_id' }
  )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${organizationId}/reports/performance/settings`)
  return { success: true }
}

export async function resetPromptOverride(
  organizationId: string,
  block: NarrativeBlockKey
): Promise<ActionOk | ActionErr> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  if (!NARRATIVE_BLOCK_KEYS.includes(block)) {
    return { success: false, error: 'Invalid block key' }
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('marketing_review_prompt_overrides')
    .select('prompts')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!existing) return { success: true }

  const current = filterPromptOverrides(existing.prompts)
  delete current[block]

  const { error } = await supabase
    .from('marketing_review_prompt_overrides')
    .update({
      prompts: current,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })
    .eq('organization_id', organizationId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${organizationId}/reports/performance/settings`)
  return { success: true }
}
