import type { AuditInputData } from '@/lib/reviews/types'
import { createServiceClient } from '@/lib/supabase/server'
import { UnifiedAuditStatus, CheckStatus, CheckPriority } from '@/lib/enums'

export async function fetchAuditData(organizationId: string): Promise<AuditInputData | null> {
  const supabase = createServiceClient()

  const { data: audit } = await supabase
    .from('audits')
    .select('id, seo_score, performance_score, ai_readiness_score')
    .eq('organization_id', organizationId)
    .eq('status', UnifiedAuditStatus.Completed)
    .not('overall_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!audit) return null

  const { data: checks } = await supabase
    .from('audit_checks')
    .select('id, check_name, display_name, priority, category')
    .eq('audit_id', audit.id)
    .eq('status', CheckStatus.Failed)
    .eq('priority', CheckPriority.Critical)
    .limit(5)

  return {
    audit_id: audit.id,
    seo_score: audit.seo_score,
    performance_score: audit.performance_score,
    ai_readiness_score: audit.ai_readiness_score,
    top_failed_checks: checks ?? [],
  }
}
