'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { SiteAudit } from '@/lib/audit/types'

export async function getSiteAuditData(projectId?: string) {
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

  // Build audits query
  let auditsQuery = supabase
    .from('site_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  // Filter by project if provided
  if (projectId) {
    auditsQuery = auditsQuery.eq('project_id', projectId)
  }

  const { data: audits } = await auditsQuery

  // Build archived audits query
  let archivedQuery = supabase
    .from('site_audits')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false })

  if (projectId) {
    archivedQuery = archivedQuery.eq('project_id', projectId)
  }

  const { data: archivedAudits } = await archivedQuery

  // Get projects for selector
  const { data: projects } = await supabase
    .from('seo_projects')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  return {
    audits: (audits ?? []) as SiteAudit[],
    archivedAudits: (archivedAudits ?? []) as SiteAudit[],
    projects: projects ?? [],
    organizationId: userRecord.organization_id,
  }
}
