'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, FileSearch, Loader2, Trash2, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ScoreTrendChart, type ScoreDataPoint } from '@/components/audit/score-trend-chart'
import { notifyAuditStarted } from '@/hooks/use-active-audit'
import { useBuildOrgHref } from '@/hooks/use-org-context'
import { formatDuration, calculateDuration, formatAuditDate, getDomain } from '@/lib/utils'
import { deleteUnifiedAudit } from './actions'
import type { UnifiedAudit } from '@/lib/unified-audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface UnifiedAuditClientProps {
  audits: UnifiedAudit[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

function isInProgress(status: string): boolean {
  return (
    status === 'pending' ||
    status === 'crawling' ||
    status === 'checking' ||
    status === 'batch_complete' ||
    status === 'awaiting_confirmation'
  )
}

export function UnifiedAuditClient({
  audits,
  organizations,
  selectedOrganizationId,
}: UnifiedAuditClientProps) {
  const router = useRouter()
  const buildOrgHref = useBuildOrgHref()
  const [searchQuery, setSearchQuery] = useState('')
  const [oneTimeUrl, setOneTimeUrl] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine audit target
  const selectedTarget = useMemo(() => {
    if (selectedOrganizationId) {
      const org = organizations.find((o) => o.id === selectedOrganizationId)
      if (org?.website_url) {
        return { type: 'organization' as const, organizationId: org.id, url: org.website_url }
      }
    }
    return { type: 'one-time' as const }
  }, [selectedOrganizationId, organizations])

  const handleStartAudit = async (url?: string) => {
    const auditUrl = url || oneTimeUrl.trim()
    if (!auditUrl) return

    let normalizedUrl = auditUrl
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    setError(null)
    setIsStarting(true)

    try {
      const response = await fetch('/api/unified-audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          organizationId:
            selectedTarget.type === 'organization' ? selectedTarget.organizationId : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to start audit')
        return
      }

      const data = await response.json()
      notifyAuditStarted()
      router.push(buildOrgHref(`/seo/audit/${data.auditId}`))
    } catch (err) {
      console.error('[Unified Audit] Failed to start:', err)
      setError('Failed to start audit')
    } finally {
      setIsStarting(false)
    }
  }

  const handleDeleteAudit = async (auditId: string) => {
    const result = await deleteUnifiedAudit(auditId)
    if (!result.error) {
      router.refresh()
    }
  }

  // Filter audits
  const filteredAudits = useMemo(() => {
    let result = audits
    if (selectedTarget.type === 'organization') {
      result = result.filter((a) => a.organization_id === selectedTarget.organizationId)
    } else {
      result = result.filter((a) => a.organization_id === null)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        result = result.filter(
          (a) => a.url.toLowerCase().includes(query) || a.domain.toLowerCase().includes(query)
        )
      }
    }
    return result
  }, [audits, selectedTarget, searchQuery])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="unified-audit-page-title">
          Full Site Audit
        </h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive site analysis across SEO, Performance, and AI Readiness
        </p>
      </div>

      {/* No organizations */}
      {organizations.length === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" aria-hidden="true" />
            </div>
            <CardTitle>No Organizations Yet</CardTitle>
            <CardDescription>
              Create an organization to start running unified audits.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Organization mode: Run button */}
      {selectedTarget.type === 'organization' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedTarget.url}</CardTitle>
                <CardDescription>Organization URL</CardDescription>
              </div>
              <Button onClick={() => handleStartAudit(selectedTarget.url)} disabled={isStarting}>
                {isStarting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  'Run New Audit'
                )}
              </Button>
            </div>
            {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
          </CardHeader>
        </Card>
      )}

      {/* One-time mode: URL input */}
      {selectedTarget.type === 'one-time' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>One-Time Audit</CardTitle>
                <CardDescription>Enter a URL to audit</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com"
                  className="w-64"
                  value={oneTimeUrl}
                  onChange={(e) => setOneTimeUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && oneTimeUrl.trim()) handleStartAudit()
                  }}
                  data-testid="audit-url-input"
                />
                <Button
                  onClick={() => handleStartAudit()}
                  disabled={!oneTimeUrl.trim() || isStarting}
                  data-testid="audit-run-button"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    'Run Audit'
                  )}
                </Button>
              </div>
            </div>
            {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
          </CardHeader>
        </Card>
      )}

      {/* Score History (org mode only) */}
      {selectedTarget.type === 'organization' && filteredAudits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score History</CardTitle>
            <CardDescription>Higher is better — fewer issues found on site</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart
              dataPoints={filteredAudits
                .filter((a) => a.status === 'completed' && a.overall_score !== null)
                .map(
                  (a): ScoreDataPoint => ({
                    score: a.overall_score as number,
                    completedAt: a.completed_at,
                  })
                )}
            />
          </CardContent>
        </Card>
      )}

      {/* Audit History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedTarget.type === 'one-time' ? 'One-time Audit History' : 'Audit History'}
              </CardTitle>
              {selectedTarget.type === 'one-time' && (
                <CardDescription>
                  Audits run on URLs not associated with an organization
                </CardDescription>
              )}
            </div>
            {selectedTarget.type === 'one-time' && (
              <div className="relative w-64">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  type="text"
                  placeholder="Search by URL..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredAudits.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No audits yet"
              description="Run your first audit to get started."
            />
          ) : (
            <div className="divide-y">
              {filteredAudits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground w-28 text-sm">
                      {formatAuditDate(audit.created_at ?? '')}
                    </span>
                    {selectedTarget.type === 'one-time' && (
                      <span className="max-w-[200px] truncate text-sm font-medium">
                        {getDomain(audit.url)}
                      </span>
                    )}
                    {isInProgress(audit.status) ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        <Badge variant="outline">In Progress</Badge>
                      </div>
                    ) : audit.status === 'failed' ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Failed</Badge>
                        {audit.error_message && (
                          <span className="max-w-[300px] truncate text-xs text-red-600">
                            {audit.error_message}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-medium tabular-nums">
                        {audit.overall_score !== null ? `${audit.overall_score}/100` : '-'}
                      </span>
                    )}
                    <span className="text-muted-foreground text-sm">
                      {audit.pages_crawled} {audit.pages_crawled === 1 ? 'page' : 'pages'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {(audit.status === 'completed' || audit.status === 'stopped') &&
                      (audit.failed_count > 0 ||
                        audit.warning_count > 0 ||
                        audit.passed_count > 0) && (
                        <>
                          <div className="flex items-center gap-2 text-xs">
                            {audit.failed_count > 0 && (
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 tabular-nums">
                                {audit.failed_count} failed
                              </span>
                            )}
                            {audit.warning_count > 0 && (
                              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700 tabular-nums">
                                {audit.warning_count} warnings
                              </span>
                            )}
                            {audit.passed_count > 0 && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 tabular-nums">
                                {audit.passed_count} passed
                              </span>
                            )}
                          </div>
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
                      <Link href={buildOrgHref(`/seo/audit/${audit.id}`)}>View</Link>
                    </Button>
                    {selectedTarget.type === 'one-time' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartAudit(audit.url)}
                        disabled={isStarting || isInProgress(audit.status)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Re-run audit"
                      >
                        <RefreshCw className={`h-4 w-4 ${isStarting ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAudit(audit.id)}
                      disabled={isInProgress(audit.status)}
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
    </div>
  )
}
