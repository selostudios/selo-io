import { createClient } from '@/lib/supabase/server'
import { canAccessAllAudits } from '@/lib/permissions'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import type { GEOAudit } from '@/lib/geo/types'

export async function getGEOAuditData(organizationId?: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get user's organization, internal status, and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    throw new Error('User not found')
  }

  const isInternal = userRecord.is_internal === true

  // Fetch organizations for selector (internal users only)
  let organizations: OrganizationForSelector[] = []
  if (isInternal && canAccessAllAudits({ is_internal: isInternal, role: userRecord.role })) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, website_url, status, logo_url')
      .order('name')

    organizations = orgs ?? []
  } else if (userRecord.organization_id) {
    // External users see only their organization
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, website_url, status, logo_url')
      .eq('id', userRecord.organization_id)
      .single()

    if (org) {
      organizations = [org]
    }
  }

  // Determine selected organization
  let selectedOrganizationId: string | null = null
  if (organizationId) {
    // URL param takes precedence
    selectedOrganizationId = organizationId
  } else if (!isInternal && userRecord.organization_id) {
    // External users always use their organization
    selectedOrganizationId = userRecord.organization_id
  }

  // Fetch audit history for selected organization or one-time audits
  let audits: GEOAudit[] = []
  if (selectedOrganizationId) {
    // Organization audits
    const { data: orgAudits } = await supabase
      .from('geo_audits')
      .select('*')
      .eq('organization_id', selectedOrganizationId)
      .order('created_at', { ascending: false })
      .limit(20)

    audits = orgAudits ?? []
  } else if (isInternal || (!selectedOrganizationId && !userRecord.organization_id)) {
    // One-time audits (for internal users or users without org)
    const { data: oneTimeAudits } = await supabase
      .from('geo_audits')
      .select('*')
      .is('organization_id', null)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    audits = oneTimeAudits ?? []
  }

  // Fetch recommendation counts for each completed audit
  if (audits.length > 0) {
    const auditIds = audits.filter((a) => a.status === 'completed').map((a) => a.id)

    if (auditIds.length > 0) {
      const { data: analyses } = await supabase
        .from('geo_ai_analyses')
        .select('audit_id, recommendations')
        .in('audit_id', auditIds)

      if (analyses) {
        // Count recommendations by priority for each audit
        const countsByAudit: Record<
          string,
          { critical: number; high: number }
        > = {}

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
