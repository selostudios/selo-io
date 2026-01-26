'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { FileSearch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditTargetSelector, type AuditTarget } from '@/components/seo/audit-target-selector'
import { AuditDashboard } from '@/components/audit/audit-dashboard'
import type { SiteAudit } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface SiteAuditClientProps {
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
  initialUrl?: string
}

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_ONE_TIME_URL_KEY = 'selo-last-one-time-url'

function getInitialTarget(
  selectedOrganizationId: string | null,
  initialUrl: string | undefined,
  organizations: OrganizationForSelector[]
): AuditTarget {
  // If a URL is provided (one-time audit), use it
  if (initialUrl) {
    return {
      type: 'one-time',
      url: initialUrl,
    }
  }

  // If an organization is selected via URL param
  if (selectedOrganizationId) {
    const org = organizations.find((o) => o.id === selectedOrganizationId)
    if (org?.website_url) {
      return {
        type: 'organization',
        organizationId: org.id,
        url: org.website_url,
      }
    }
  }

  // Check localStorage for last one-time URL (takes precedence over org)
  if (typeof window !== 'undefined') {
    const lastOneTimeUrl = localStorage.getItem(LAST_ONE_TIME_URL_KEY)
    if (lastOneTimeUrl) {
      return {
        type: 'one-time',
        url: lastOneTimeUrl,
      }
    }
  }

  // Check localStorage for last selected org
  if (typeof window !== 'undefined') {
    const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
    if (lastOrgId) {
      const org = organizations.find((o) => o.id === lastOrgId)
      if (org?.website_url) {
        return {
          type: 'organization',
          organizationId: org.id,
          url: org.website_url,
        }
      }
    }
  }

  // Fall back to first organization with a website URL
  const firstOrgWithUrl = organizations.find((o) => o.website_url)
  if (firstOrgWithUrl) {
    return {
      type: 'organization',
      organizationId: firstOrgWithUrl.id,
      url: firstOrgWithUrl.website_url!,
    }
  }

  return null
}

export function SiteAuditClient({
  audits,
  archivedAudits,
  organizations,
  isInternal,
  selectedOrganizationId,
  initialUrl,
}: SiteAuditClientProps) {
  const router = useRouter()

  // Initialize selectedTarget based on URL param, localStorage, or first org
  const [selectedTarget, setSelectedTarget] = useState<AuditTarget>(() =>
    getInitialTarget(selectedOrganizationId, initialUrl, organizations)
  )

  const handleTargetChange = (target: AuditTarget) => {
    setSelectedTarget(target)

    // Update URL and localStorage when organization is selected
    if (target?.type === 'organization') {
      localStorage.setItem(LAST_ORG_KEY, target.organizationId)
      localStorage.removeItem(LAST_ONE_TIME_URL_KEY)
      router.push(`/seo/site-audit?org=${target.organizationId}`)
    } else if (target?.type === 'one-time') {
      // For one-time URLs, persist the URL in localStorage and query param
      localStorage.setItem(LAST_ONE_TIME_URL_KEY, target.url)
      localStorage.removeItem(LAST_ORG_KEY)
      router.push(`/seo/site-audit?url=${encodeURIComponent(target.url)}`)
    } else if (target?.type === 'one-time-history') {
      // For one-time history view, clear localStorage and params
      localStorage.removeItem(LAST_ONE_TIME_URL_KEY)
      localStorage.removeItem(LAST_ORG_KEY)
      router.push('/seo/site-audit')
    }
  }

  // Filter audits to match the selected target
  // - For organization targets: only show audits for that organization
  // - For one-time targets: show all one-time audits
  // - For one-time-history targets: show all audits with no organization
  const filteredAudits = useMemo(() => {
    if (!selectedTarget) return []

    if (selectedTarget.type === 'organization') {
      return audits.filter((audit) => audit.organization_id === selectedTarget.organizationId)
    } else if (selectedTarget.type === 'one-time') {
      // For one-time URLs, show all one-time audits
      // TODO: In the future, we could filter by specific URL
      return audits.filter((audit) => audit.organization_id === null)
    } else {
      // One-time-history: show all audits with no organization_id
      return audits.filter((audit) => audit.organization_id === null)
    }
  }, [audits, selectedTarget])

  const filteredArchivedAudits = useMemo(() => {
    if (!selectedTarget) return []

    if (selectedTarget.type === 'organization') {
      return archivedAudits.filter(
        (audit) => audit.organization_id === selectedTarget.organizationId
      )
    } else if (selectedTarget.type === 'one-time') {
      // For one-time URLs, show all one-time audits
      return archivedAudits.filter((audit) => audit.organization_id === null)
    } else {
      // One-time-history: show all audits with no organization_id
      return archivedAudits.filter((audit) => audit.organization_id === null)
    }
  }, [archivedAudits, selectedTarget])

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <FileSearch className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold">Site Audit</h1>
          <p className="text-muted-foreground">
            Crawl and analyze websites for SEO issues, missing meta tags, broken links, and
            technical problems
          </p>
        </div>
      </div>

      {/* Audit Target Selector */}
      <div className="flex items-center justify-between">
        <AuditTargetSelector
          organizations={organizations}
          selectedTarget={selectedTarget}
          onTargetChange={handleTargetChange}
          isInternal={isInternal}
        />
      </div>

      {/* If no organizations exist, show setup message */}
      {organizations.length === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>No Organizations Yet</CardTitle>
            <CardDescription>
              Create an organization to start running site audits. Organizations let you organize
              audits for different websites.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm">
              Click the selector above to create your first organization.
            </p>
          </CardContent>
        </Card>
      )}

      {/* If organizations exist but none selected, prompt to select one */}
      {organizations.length > 0 && !selectedTarget && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>Select an Audit Target</CardTitle>
            <CardDescription>
              Choose an organization or enter a one-time URL from the selector above to view its
              site audits.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Show dashboard when target is selected */}
      {selectedTarget && selectedTarget.type !== 'one-time-history' && selectedTarget.url && (
        <AuditDashboard
          websiteUrl={selectedTarget.url}
          audits={filteredAudits}
          archivedAudits={filteredArchivedAudits}
          organizationId={
            selectedTarget.type === 'organization' ? selectedTarget.organizationId : undefined
          }
        />
      )}

      {/* Show one-time audit history when selected */}
      {selectedTarget?.type === 'one-time-history' && (
        <AuditDashboard
          audits={filteredAudits}
          archivedAudits={filteredArchivedAudits}
          isOneTimeHistory
        />
      )}
    </div>
  )
}
