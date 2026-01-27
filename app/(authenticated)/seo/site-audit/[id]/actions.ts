'use server'

import { createClient } from '@/lib/supabase/server'
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

  // Fetch all checks for this audit (paginate to overcome 1000 row limit)
  const allChecks: SiteAuditCheck[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: checksPage, error: checksError } = await supabase
      .from('site_audit_checks')
      .select('*')
      .eq('audit_id', id)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (checksError) {
      console.error('[Get Audit Report Error]', {
        type: 'checks_fetch_failed',
        auditId: id,
        error: checksError,
        timestamp: new Date().toISOString(),
      })
      notFound()
    }

    if (checksPage && checksPage.length > 0) {
      allChecks.push(...(checksPage as SiteAuditCheck[]))
      offset += pageSize
      hasMore = checksPage.length === pageSize
    } else {
      hasMore = false
    }
  }

  const checks = allChecks

  // Fetch all pages for this audit (paginate to overcome 1000 row limit)
  const allPages: SiteAuditPage[] = []
  offset = 0
  hasMore = true

  while (hasMore) {
    const { data: pagesPage, error: pagesError } = await supabase
      .from('site_audit_pages')
      .select('*')
      .eq('audit_id', id)
      .order('crawled_at', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (pagesError) {
      console.error('[Get Audit Report Error]', {
        type: 'pages_fetch_failed',
        auditId: id,
        timestamp: new Date().toISOString(),
      })
      notFound()
    }

    if (pagesPage && pagesPage.length > 0) {
      allPages.push(...(pagesPage as SiteAuditPage[]))
      offset += pageSize
      hasMore = pagesPage.length === pageSize
    } else {
      hasMore = false
    }
  }

  return {
    audit: audit as SiteAudit,
    checks,
    pages: allPages,
  }
}
