import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getOrganizations } from '@/lib/organizations/actions'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { AIOAudit } from '@/lib/aio/types'

export async function getAIOAuditData(organizationId?: string) {
  const supabase = await createClient()

  const currentUser = await getCurrentUser()

  if (!currentUser) {
    throw new Error('Unauthorized')
  }

  const { isInternal, organizationId: userOrgId } = currentUser

  // Get organizations for selector (already filtered to exclude inactive)
  const orgs = await getOrganizations()
  const organizations: OrganizationForSelector[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    website_url: org.website_url,
    status: org.status,
    logo_url: org.logo_url,
  }))

  // Determine selected organization
  let selectedOrganizationId: string | null = null
  if (organizationId) {
    // URL param takes precedence
    selectedOrganizationId = organizationId
  } else if (!isInternal && userOrgId) {
    // External users always use their organization
    selectedOrganizationId = userOrgId
  }

  // Fetch audit history for selected organization or one-time audits
  let audits: AIOAudit[] = []
  if (selectedOrganizationId) {
    // Organization audits
    const { data: orgAudits } = await supabase
      .from('aio_audits')
      .select('*')
      .eq('organization_id', selectedOrganizationId)
      .order('created_at', { ascending: false })
      .limit(20)

    audits = orgAudits ?? []
  } else if (isInternal || (!selectedOrganizationId && !userOrgId)) {
    // One-time audits (for internal users or users without org)
    const { data: oneTimeAudits } = await supabase
      .from('aio_audits')
      .select('*')
      .is('organization_id', null)
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20)

    audits = oneTimeAudits ?? []
  }

  // Fetch recommendation counts for each completed audit
  if (audits.length > 0) {
    const auditIds = audits.filter((a) => a.status === 'completed').map((a) => a.id)

    if (auditIds.length > 0) {
      const { data: analyses } = await supabase
        .from('aio_ai_analyses')
        .select('audit_id, recommendations')
        .in('audit_id', auditIds)

      if (analyses) {
        // Count recommendations by priority for each audit
        const countsByAudit: Record<string, { critical: number; high: number }> = {}

        for (const analysis of analyses) {
          if (!countsByAudit[analysis.audit_id]) {
            countsByAudit[analysis.audit_id] = { critical: 0, high: 0 }
          }

          const recommendations = analysis.recommendations as Array<{ priority: string }>
          for (const rec of recommendations) {
            const priority = rec.priority.toLowerCase()
            if (priority === 'critical') {
              countsByAudit[analysis.audit_id].critical++
            } else if (priority === 'high') {
              countsByAudit[analysis.audit_id].high++
            }
          }
        }

        // Attach counts to audits
        audits = audits.map((audit) => ({
          ...audit,
          critical_recommendations: countsByAudit[audit.id]?.critical || 0,
          high_recommendations: countsByAudit[audit.id]?.high || 0,
        }))
      }
    }
  }

  return {
    organizations,
    isInternal,
    selectedOrganizationId,
    audits,
  }
}
