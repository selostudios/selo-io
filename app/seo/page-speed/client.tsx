'use client'

import { useState } from 'react'
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

function getInitialTarget(
  selectedOrganizationId: string | null,
  organizations: OrganizationForSelector[],
  isInternal: boolean
): AuditTarget {
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

  // For external users, auto-select their organization
  if (!isInternal && organizations.length === 1) {
    const org = organizations[0]
    if (org.website_url) {
      return {
        type: 'organization',
        organizationId: org.id,
        url: org.website_url,
      }
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

  // Initialize selectedTarget based on selectedOrganizationId or auto-select for external users
  const [selectedTarget, setSelectedTarget] = useState<AuditTarget>(() =>
    getInitialTarget(selectedOrganizationId, organizations, isInternal)
  )

  const handleTargetChange = (target: AuditTarget) => {
    setSelectedTarget(target)

    // Update URL when organization is selected
    if (target?.type === 'organization') {
      router.push(`/seo/page-speed?org=${target.organizationId}`)
    } else if (target?.type === 'one-time') {
      // For one-time URLs, clear the org param
      router.push('/seo/page-speed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <Gauge className="mt-1 h-8 w-8 text-neutral-700" />
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
              <Gauge className="h-6 w-6 text-neutral-600" />
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
              <Gauge className="h-6 w-6 text-neutral-600" />
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
      {selectedTarget && (
        <PerformanceDashboard
          audits={audits}
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
