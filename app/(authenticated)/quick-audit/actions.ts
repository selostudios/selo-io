'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import type { UnifiedAudit } from '@/lib/unified-audit/types'

const AUDIT_SELECT = `
  id, organization_id, created_by, domain, url, status,
  seo_score, performance_score, ai_readiness_score, overall_score,
  pages_crawled, crawl_mode, max_pages,
  passed_count, warning_count, failed_count,
  executive_summary, error_message,
  started_at, completed_at, created_at
`

export async function getQuickAudits(): Promise<UnifiedAudit[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord) redirect('/login')
  if (!isInternalUser(userRecord)) redirect('/dashboard')

  const { data: audits } = await supabase
    .from('audits')
    .select(AUDIT_SELECT)
    .is('organization_id', null)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (audits ?? []) as UnifiedAudit[]
}
