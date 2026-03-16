'use server'

import { createClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import { notFound } from 'next/navigation'
import type { SiteAudit, SiteAuditCheck, SiteAuditPage } from '@/lib/audit/types'

export interface AuditReportData {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

export async function getAuditReport(id: string): Promise<AuditReportData> {
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
    notFound()
  }

  // Fetch all checks and pages in parallel (paginated to overcome 1000 row limit)
  let checks: SiteAuditCheck[]
  let pages: SiteAuditPage[]

  try {
    ;[checks, pages] = await Promise.all([
      paginateQuery<SiteAuditCheck>(
        (sb, range) =>
          sb
            .from('site_audit_checks')
            .select('*')
            .eq('audit_id', id)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
      paginateQuery<SiteAuditPage>(
        (sb, range) =>
          sb
            .from('site_audit_pages')
            .select('*')
            .eq('audit_id', id)
            .order('crawled_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
    ])
  } catch (err) {
    console.error('[Get Audit Report Error]', {
      type: 'paginated_fetch_failed',
      auditId: id,
      error: err,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  return {
    audit: audit as SiteAudit,
    checks,
    pages,
  }
}
