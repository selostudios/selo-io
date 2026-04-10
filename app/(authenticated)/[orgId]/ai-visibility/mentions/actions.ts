'use server'

import { createClient } from '@/lib/supabase/server'
import { getMentions } from '@/lib/ai-visibility/queries'
import type { MentionsPage } from '@/lib/ai-visibility/queries'

export async function loadMoreMentions(
  orgId: string,
  filters: { platform?: string; sentiment?: string; days?: number; search?: string },
  cursor: string
): Promise<MentionsPage> {
  const supabase = await createClient()
  return getMentions(supabase, orgId, filters, cursor)
}
