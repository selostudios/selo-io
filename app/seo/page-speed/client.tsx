'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gauge, Search } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
}

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_VIEW_KEY = 'selo-last-view-type'

function getInitialTarget(
  selectedOrganizationId: string | null,
  organizations: OrganizationForSelector[]
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

  // Check localStorage for last view type
  if (typeof window !== 'undefined') {
    const lastViewType = localStorage.getItem(LAST_VIEW_KEY)
    if (lastViewType === 'one-time') {
      return { type: 'one-time' }
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
}: PageSpeedClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize selectedTarget based on URL param, localStorage, or first org
  const [selectedTarget, setSelectedTarget] = useState<AuditTarget>(() =>
    getInitialTarget(selectedOrganizationId, organizations)
  )

  const handleTargetChange = (target: AuditTarget) => {
    setSelectedTarget(target)
    setSearchQuery('')

    // Update URL and localStorage when target changes
    if (target?.type === 'organization') {
      localStorage.setItem(LAST_ORG_KEY, target.organizationId)
      localStorage.setItem(LAST_VIEW_KEY, 'organization')
      router.push(`/seo/page-speed?org=${target.organizationId}`)
    } else if (target?.type === 'one-time') {
      localStorage.removeItem(LAST_ORG_KEY)
      localStorage.setItem(LAST_VIEW_KEY, 'one-time')
      router.push('/seo/page-speed')
    }
  }

  // Filter audits to match the selected target
  // - For organization targets: only show audits for that organization
  // - For one-time targets: show all one-time audits, filtered by search query
  const filteredAudits = useMemo(() => {
    if (!selectedTarget) return []

    if (selectedTarget.type === 'organization') {
      return audits.filter((audit) => audit.organization_id === selectedTarget.organizationId)
    } else {
      // One-time: show all audits with no organization_id
      let oneTimeAudits = audits.filter((audit) => audit.organization_id === null)

      // Apply search filter if query exists
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        oneTimeAudits = oneTimeAudits.filter((audit) => {
          const url = audit.first_url || audit.current_url || ''
          return url.toLowerCase().includes(query)
        })
      }

      return oneTimeAudits
    }
  }, [audits, selectedTarget, searchQuery])

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

      {/* Show dashboard when organization is selected */}
      {selectedTarget?.type === 'organization' && (
        <PerformanceDashboard
          audits={filteredAudits}
          monitoredPages={monitoredPages}
          websiteUrl={selectedTarget.url}
          organizationId={selectedTarget.organizationId}
        />
      )}

      {/* Show one-time audit history with search when one-time is selected */}
      {selectedTarget?.type === 'one-time' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>One-time Audit History</CardTitle>
                  <CardDescription>
                    Performance audits run on URLs not associated with an organization
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    type="text"
                    placeholder="Search by URL..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAudits.length === 0 ? (
                <div className="py-12 text-center">
                  <Gauge className="mx-auto h-12 w-12 text-neutral-400" />
                  <h3 className="mt-4 text-lg font-medium">
                    {searchQuery ? 'No matching audits' : 'No one-time audits yet'}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {searchQuery
                      ? 'Try a different search term'
                      : 'Run a one-time audit by entering a URL in the dashboard.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAudits.map((audit) => (
                    <div
                      key={audit.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-6">
                        <span className="text-muted-foreground w-28 text-sm">
                          {new Date(audit.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {(audit.first_url || audit.current_url) && (
                          <span className="max-w-[300px] truncate text-sm font-medium">
                            {audit.first_url || audit.current_url}
                          </span>
                        )}
                        <span className="text-muted-foreground text-sm">
                          {audit.total_urls
                            ? `${audit.total_urls} ${audit.total_urls === 1 ? 'page' : 'pages'}`
                            : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {audit.status === 'completed' && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            Completed
                          </span>
                        )}
                        {audit.status === 'failed' && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            Failed
                          </span>
                        )}
                        {(audit.status === 'pending' || audit.status === 'running') && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                            In Progress
                          </span>
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/seo/page-speed/${audit.id}`}>View</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
