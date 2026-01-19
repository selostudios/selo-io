'use server'

import { createClient } from '@/lib/supabase/server'
import type { SiteAudit, SiteAuditCheck, SiteAuditPage } from '@/lib/audit/types'

export interface AuditReportData {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

export async function getAuditReport(id: string): Promise<AuditReportData | null> {
  const supabase = await createClient()

  // Fetch audit - RLS ensures user can only access audits from their organization
  const { data: audit, error: auditError } = await supabase
    .from('site_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (auditError || !audit) {
    console.error('[Get Audit Report Error]', {
      type: 'audit_not_found',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  // Fetch checks for this audit
  const { data: checks, error: checksError } = await supabase
    .from('site_audit_checks')
    .select('*')
    .eq('audit_id', id)
    .order('created_at', { ascending: true })

  if (checksError) {
    console.error('[Get Audit Report Error]', {
      type: 'checks_fetch_failed',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  // Fetch pages for this audit
  const { data: pages, error: pagesError } = await supabase
    .from('site_audit_pages')
    .select('*')
    .eq('audit_id', id)
    .order('crawled_at', { ascending: true })

  if (pagesError) {
    console.error('[Get Audit Report Error]', {
      type: 'pages_fetch_failed',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return {
    audit: audit as SiteAudit,
    checks: (checks ?? []) as SiteAuditCheck[],
    pages: (pages ?? []) as SiteAuditPage[],
  }
}
