'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditTargetSelector, type AuditTarget } from '@/components/seo/audit-target-selector'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface PageSpeedClientProps {
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
  initialUrl?: string
}

const LAST_ORG_KEY = 'selo-last-organization-id'

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

export function PageSpeedClient({
  audits,
  monitoredPages,
  organizations,
  isInternal,
  selectedOrganizationId,
  initialUrl,
}: PageSpeedClientProps) {
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
      router.push(`/seo/page-speed?org=${target.organizationId}`)
    } else if (target?.type === 'one-time') {
      // For one-time URLs, persist the URL in the query param
      router.push(`/seo/page-speed?url=${encodeURIComponent(target.url)}`)
    } else if (target?.type === 'one-time-history') {
      // For one-time history, clear params
      router.push('/seo/page-speed')
    }
  }

  // Filter audits to match the selected target
  // - For organization targets: only show audits for that organization
  // - For one-time targets: only show audits for the specific URL
  // - For one-time-history targets: show all audits with no organization
  const filteredAudits = useMemo(() => {
    if (!selectedTarget) return []

    if (selectedTarget.type === 'organization') {
      return audits.filter((audit) => audit.organization_id === selectedTarget.organizationId)
    } else if (selectedTarget.type === 'one-time') {
      // For one-time URLs, show all one-time audits
      // TODO: In the future, we could filter by specific URL by querying audit results
      return audits.filter((audit) => audit.organization_id === null)
    } else {
      // One-time-history: show all audits with no organization_id
      return audits.filter((audit) => audit.organization_id === null)
    }
  }, [audits, selectedTarget])

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <Gauge className="mt-1 h-8 w-8 text-neutral-700" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold">Page Speed</h1>
          <p className="text-muted-foreground">
            Measure Core Web Vitals, load times, and performance scores using Google PageSpeed
            Insights
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
              <Gauge className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>No Organizations Yet</CardTitle>
            <CardDescription>
              Create an organization to start running page speed audits. Organizations let you
              organize audits for different websites.
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
              <Gauge className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>Select an Audit Target</CardTitle>
            <CardDescription>
              Choose an organization or enter a one-time URL from the selector above to view its
              page speed audits.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Show dashboard when target is selected */}
      {selectedTarget && selectedTarget.type !== 'one-time-history' && (
        <PerformanceDashboard
          audits={filteredAudits}
          monitoredPages={monitoredPages}
          websiteUrl={selectedTarget.url}
          initialUrl={initialUrl}
          organizationId={
            selectedTarget.type === 'organization' ? selectedTarget.organizationId : undefined
          }
        />
      )}
    </div>
  )
}
