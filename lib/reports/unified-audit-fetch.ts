import type { SupabaseClient } from '@supabase/supabase-js'
import type { UnifiedAudit } from '@/lib/unified-audit/types'

/**
 * Subset of unified-audit fields needed for report rendering and summary generation.
 */
export type UnifiedAuditScores = Pick<
  UnifiedAudit,
  'seo_score' | 'performance_score' | 'ai_readiness_score' | 'pages_crawled'
>

/**
 * Fetch the unified-audit scores that back a generated report.
 *
 * Returns `null` for legacy reports (no `audit_id`) or when the row can't be loaded.
 * Uses `.maybeSingle()` so a missing row resolves to `null` without logging an error —
 * only genuine fetch failures are logged.
 *
 * Accepts any Supabase client so both authenticated (RLS-scoped) and service-role
 * (public share) paths can share the same query + error-handling shape.
 */
export async function fetchUnifiedAuditScores(
  supabase: SupabaseClient,
  auditId: string | null
): Promise<UnifiedAuditScores | null> {
  if (!auditId) return null

  const { data, error } = await supabase
    .from('audits')
    .select('seo_score, performance_score, ai_readiness_score, pages_crawled')
    .eq('id', auditId)
    .maybeSingle()

  if (error) {
    console.error('[Unified Audit Fetch Error]', {
      type: 'fetch_failed',
      auditId,
      message: error.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  return (data as UnifiedAuditScores | null) ?? null
}
