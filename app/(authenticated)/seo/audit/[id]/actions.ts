'use server'

import { createClient } from '@/lib/supabase/server'
import { paginateQuery } from '@/lib/supabase/paginate'
import { notFound } from 'next/navigation'
import { canAccessAllAudits } from '@/lib/permissions'
import { ScoreDimension } from '@/lib/enums'
import type {
  UnifiedAudit,
  AuditCheck,
  AuditPage,
  AuditAIAnalysis,
} from '@/lib/unified-audit/types'

// =============================================================================
// Types
// =============================================================================

export interface UnifiedAuditReportData {
  audit: UnifiedAudit
  checks: AuditCheck[]
  pages: AuditPage[]
}

export interface UnifiedAuditDetailData extends UnifiedAuditReportData {
  aiAnalyses: AuditAIAnalysis[]
}

// =============================================================================
// Detail Actions
// =============================================================================

/**
 * Get full audit report data with checks and pages (paginated).
 * Used by the audit detail/report page.
 */
export async function getUnifiedAuditReport(id: string): Promise<UnifiedAuditReportData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()
  if (!userRecord) notFound()

  // Fetch audit
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select('*')
    .eq('id', id)
    .single()

  if (auditError || !audit) {
    console.error('[Get Unified Audit Report Error]', {
      type: 'audit_not_found',
      auditId: id,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  // Verify access
  const hasAccess =
    audit.organization_id === userRecord.organization_id ||
    (audit.organization_id === null && audit.created_by === user.id) ||
    canAccessAllAudits(userRecord)

  if (!hasAccess) notFound()

  // Fetch checks and pages in parallel (paginated for large audits)
  let checks: AuditCheck[]
  let pages: AuditPage[]

  try {
    ;[checks, pages] = await Promise.all([
      paginateQuery<AuditCheck>(
        (sb, range) =>
          sb
            .from('audit_checks')
            .select('*')
            .eq('audit_id', id)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
      paginateQuery<AuditPage>(
        (sb, range) =>
          sb
            .from('audit_pages')
            .select('*')
            .eq('audit_id', id)
            .order('created_at', { ascending: true })
            .range(range.from, range.to),
        supabase
      ),
    ])
  } catch (err) {
    console.error('[Get Unified Audit Report Error]', {
      type: 'paginated_fetch_failed',
      auditId: id,
      error: err,
      timestamp: new Date().toISOString(),
    })
    notFound()
  }

  return {
    audit: audit as UnifiedAudit,
    checks,
    pages,
  }
}

/**
 * Get full audit detail data including AI analyses.
 * Used by the audit detail page when AI analysis tab is active.
 */
export async function getUnifiedAuditDetail(id: string): Promise<UnifiedAuditDetailData> {
  const report = await getUnifiedAuditReport(id)

  const supabase = await createClient()

  const { data: aiAnalyses } = await supabase
    .from('audit_ai_analyses')
    .select('*')
    .eq('audit_id', id)
    .order('importance_score', { ascending: false })

  return {
    ...report,
    aiAnalyses: (aiAnalyses ?? []) as AuditAIAnalysis[],
  }
}

/**
 * Get checks filtered by score dimension tab (SEO, Performance, AI Readiness).
 * Uses the feeds_scores array to filter relevant checks.
 */
export async function getUnifiedAuditChecksByTab(
  auditId: string,
  tab: 'seo' | 'performance' | 'ai_readiness'
): Promise<AuditCheck[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const dimensionMap: Record<string, ScoreDimension> = {
    seo: ScoreDimension.SEO,
    performance: ScoreDimension.Performance,
    ai_readiness: ScoreDimension.AIReadiness,
  }

  const dimension = dimensionMap[tab]

  // Supabase supports filtering on array columns with `cs` (contains)
  const { data: checks } = await supabase
    .from('audit_checks')
    .select('*')
    .eq('audit_id', auditId)
    .contains('feeds_scores', [dimension])
    .order('created_at', { ascending: true })

  return (checks ?? []) as AuditCheck[]
}
