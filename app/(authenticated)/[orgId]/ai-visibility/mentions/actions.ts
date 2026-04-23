'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserRecord } from '@/lib/auth/cached'
import { canAccessOrg } from '@/lib/permissions'
import { getMentions } from '@/lib/ai-visibility/queries'
import type { MentionsPage } from '@/lib/ai-visibility/queries'

export async function loadMoreMentions(
  orgId: string,
  filters: { platform?: string; sentiment?: string; days?: number; search?: string },
  cursor: string
): Promise<MentionsPage> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Verify the user has access to this organization
  const userRecord = await getUserRecord(user.id)
  if (!userRecord) throw new Error('Not authenticated')

  if (!canAccessOrg(userRecord, orgId)) throw new Error('Access denied')

  return getMentions(supabase, orgId, filters, cursor)
}
