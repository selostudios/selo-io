'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getAuditData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) redirect('/login')

  const { data: org } = await supabase
    .from('organizations')
    .select('website_url')
    .eq('id', userRecord.organization_id)
    .single()

  const { data: audits } = await supabase
    .from('site_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  const { data: archivedAudits } = await supabase
    .from('site_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false })

  return {
    websiteUrl: org?.website_url ?? null,
    audits: audits ?? [],
    archivedAudits: archivedAudits ?? [],
  }
}
