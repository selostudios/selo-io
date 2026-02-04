'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, getOrganizations } from '@/lib/organizations/actions'
import { redirect } from 'next/navigation'
import type { SiteAudit } from '@/lib/audit/types'
import type { PerformanceAudit, PerformanceAuditResult } from '@/lib/performance/types'
import type { AIOAudit } from '@/lib/aio/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import { AuditStatus, PerformanceAuditStatus, AIOAuditStatus } from '@/lib/enums'
import { extractDomain } from '@/lib/reports'

export interface NewReportPageData {
  siteAudits: SiteAudit[]
  performanceAudits: (PerformanceAudit & { domain: string | null })[]
  aioAudits: AIOAudit[]
  // In-progress audits (shown but disabled)
  inProgressSiteAudits: SiteAudit[]
  inProgressPerformanceAudits: (PerformanceAudit & { domain: string | null })[]
  inProgressAioAudits: AIOAudit[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
  preselectedDomain: string | null
}

/**
 * Get data for the new report page
 * Includes all completed audits that can be used to create a report
 */
export async function getNewReportData(
  organizationId?: string,
  domain?: string
): Promise<NewReportPageData> {
  const supabase = await createClient()
  const currentUser = await getCurrentUser()

  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser
  const filterOrgId = isInternal ? organizationId || null : userOrgId

  // Fetch completed site audits
  let siteQuery = supabase
    .from('site_audits')
    .select('*')
    .eq('status', AuditStatus.Completed)
    .not('overall_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (filterOrgId) {
    siteQuery = siteQuery.eq('organization_id', filterOrgId)
  } else {
    siteQuery = siteQuery.is('organization_id', null)
  }

  const { data: siteAudits } = await siteQuery

  // Fetch in-progress site audits
  let inProgressSiteQuery = supabase
    .from('site_audits')
    .select('*')
    .in('status', [AuditStatus.Pending, AuditStatus.Crawling, AuditStatus.Checking])
    .order('created_at', { ascending: false })
    .limit(10)

  if (filterOrgId) {
    inProgressSiteQuery = inProgressSiteQuery.eq('organization_id', filterOrgId)
  } else {
    inProgressSiteQuery = inProgressSiteQuery.is('organization_id', null)
  }

  const { data: inProgressSiteAudits } = await inProgressSiteQuery

  // Fetch completed performance audits with their first URL for domain extraction
  let perfQuery = supabase
    .from('performance_audits')
    .select('*')
    .eq('status', PerformanceAuditStatus.Completed)
    .order('created_at', { ascending: false })
    .limit(50)

  if (filterOrgId) {
    perfQuery = perfQuery.eq('organization_id', filterOrgId)
  } else {
    perfQuery = perfQuery.is('organization_id', null)
  }

  const { data: perfAudits } = await perfQuery

  // Get domains for performance audits from their results
  const performanceAudits: (PerformanceAudit & { domain: string | null })[] = []
  if (perfAudits) {
    for (const audit of perfAudits) {
      const { data: results } = await supabase
        .from('performance_audit_results')
        .select('url')
        .eq('audit_id', audit.id)
        .limit(1)

      const domain = results?.[0]?.url ? extractDomain(results[0].url) : null
      performanceAudits.push({ ...audit, domain } as PerformanceAudit & { domain: string | null })
    }
  }

  // Fetch in-progress performance audits
  let inProgressPerfQuery = supabase
    .from('performance_audits')
    .select('*')
    .in('status', [PerformanceAuditStatus.Pending, PerformanceAuditStatus.Running])
    .order('created_at', { ascending: false })
    .limit(10)

  if (filterOrgId) {
    inProgressPerfQuery = inProgressPerfQuery.eq('organization_id', filterOrgId)
  } else {
    inProgressPerfQuery = inProgressPerfQuery.is('organization_id', null)
  }

  const { data: inProgressPerfAudits } = await inProgressPerfQuery

  // Get domains for in-progress performance audits
  const inProgressPerformanceAudits: (PerformanceAudit & { domain: string | null })[] = []
  if (inProgressPerfAudits) {
    for (const audit of inProgressPerfAudits) {
      const { data: results } = await supabase
        .from('performance_audit_results')
        .select('url')
        .eq('audit_id', audit.id)
        .limit(1)

      const domain = results?.[0]?.url ? extractDomain(results[0].url) : null
      inProgressPerformanceAudits.push({
        ...audit,
        domain,
      } as PerformanceAudit & { domain: string | null })
    }
  }

  // Fetch completed AIO audits
  let aioQuery = supabase
    .from('aio_audits')
    .select('*')
    .eq('status', AIOAuditStatus.Completed)
    .not('overall_aio_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (filterOrgId) {
    aioQuery = aioQuery.eq('organization_id', filterOrgId)
  } else {
    aioQuery = aioQuery.is('organization_id', null)
  }

  const { data: aioAudits } = await aioQuery

  // Fetch in-progress AIO audits
  let inProgressAioQuery = supabase
    .from('aio_audits')
    .select('*')
    .in('status', [AIOAuditStatus.Pending, AIOAuditStatus.Running])
    .order('created_at', { ascending: false })
    .limit(10)

  if (filterOrgId) {
    inProgressAioQuery = inProgressAioQuery.eq('organization_id', filterOrgId)
  } else {
    inProgressAioQuery = inProgressAioQuery.is('organization_id', null)
  }

  const { data: inProgressAioAudits } = await inProgressAioQuery

  // Get organizations for selector
  const orgs = await getOrganizations()
  const organizations: OrganizationForSelector[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    website_url: org.website_url,
    status: org.status,
    logo_url: org.logo_url,
  }))

  return {
    siteAudits: (siteAudits ?? []) as SiteAudit[],
    performanceAudits,
    aioAudits: (aioAudits ?? []) as AIOAudit[],
    inProgressSiteAudits: (inProgressSiteAudits ?? []) as SiteAudit[],
    inProgressPerformanceAudits,
    inProgressAioAudits: (inProgressAioAudits ?? []) as AIOAudit[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
    preselectedDomain: domain ?? null,
  }
}

/**
 * Get performance results for score calculation
 */
export async function getPerformanceResultsForAudit(
  auditId: string
): Promise<PerformanceAuditResult[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('performance_audit_results')
    .select('*')
    .eq('audit_id', auditId)

  return (data ?? []) as PerformanceAuditResult[]
}
