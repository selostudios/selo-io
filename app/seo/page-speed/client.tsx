'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gauge, Search, Clock, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuditTargetSelector, type AuditTarget } from '@/components/seo/audit-target-selector'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'
import { formatDuration, calculateDuration } from '@/lib/utils'

interface PageSpeedClientProps {
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_VIEW_KEY = 'selo-last-view-type'

function formatAuditDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isInProgress(status: PerformanceAudit['status']): boolean {
  return status === 'pending' || status === 'running'
}

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
  const [oneTimeUrl, setOneTimeUrl] = useState('')

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

  const handleRunOneTimeAudit = async () => {
    if (!oneTimeUrl.trim()) return

    let url = oneTimeUrl.trim()
    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    try {
      const response = await fetch('/api/performance/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] }),
      })

      if (!response.ok) {
        console.error('Failed to start audit')
        return
      }

      const data = await response.json()
      router.push(`/seo/page-speed/${data.auditId}`)
    } catch (error) {
      console.error('Failed to start audit:', error)
    }
  }

  const handleDeleteAudit = async (auditId: string) => {
    try {
      const response = await fetch(`/api/performance/${auditId}`, { method: 'DELETE' })
      if (response.ok) {
        router.refresh()
      }
    } catch (err) {
      console.error('[PageSpeed Client] Failed to delete audit:', err)
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
      <div>
        <h1 className="text-3xl font-bold">Page Speed</h1>
        <p className="text-muted-foreground">
          Measure Core Web Vitals, load times, and performance scores using Google PageSpeed
          Insights
        </p>
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

      {/* Show one-time audit interface when one-time is selected */}
      {selectedTarget?.type === 'one-time' && (
        <>
          {/* Run One-Time Audit Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>One-Time PageSpeed Audit</CardTitle>
                  <CardDescription>Add URL to begin PageSpeed audit</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    className="w-64"
                    id="one-time-url"
                    value={oneTimeUrl}
                    onChange={(e) => setOneTimeUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && oneTimeUrl.trim()) {
                        handleRunOneTimeAudit()
                      }
                    }}
                  />
                  <Button onClick={handleRunOneTimeAudit} disabled={!oneTimeUrl.trim()}>
                    Run Audit
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Audit History Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Audit History</CardTitle>
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
                      : 'Run a one-time audit by entering a URL above.'}
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
                          {formatAuditDate(audit.created_at)}
                        </span>
                        {(audit.first_url || audit.current_url) && (
                          <span className="max-w-[300px] truncate text-sm font-medium">
                            {audit.first_url || audit.current_url}
                          </span>
                        )}
                        {isInProgress(audit.status) ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                              In Progress
                            </span>
                          </div>
                        ) : audit.status === 'failed' ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                            Failed
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {audit.total_urls
                              ? `${audit.total_urls} ${audit.total_urls === 1 ? 'page' : 'pages'}`
                              : '-'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {audit.status === 'completed' && (
                          <>
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                              Completed
                            </span>
                            {(() => {
                              const duration = calculateDuration(audit.started_at, audit.completed_at)
                              return duration ? (
                                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                  <Clock className="size-3" />
                                  {formatDuration(duration)}
                                </span>
                              ) : null
                            })()}
                          </>
                        )}
                        {audit.status === 'stopped' && (
                          <>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                              Stopped
                            </span>
                            {(() => {
                              const duration = calculateDuration(audit.started_at, audit.completed_at)
                              return duration ? (
                                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                  <Clock className="size-3" />
                                  {formatDuration(duration)}
                                </span>
                              ) : null
                            })()}
                          </>
                        )}
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/seo/page-speed/${audit.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAudit(audit.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete audit"
                        >
                          <Trash2 className="h-4 w-4" />
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
