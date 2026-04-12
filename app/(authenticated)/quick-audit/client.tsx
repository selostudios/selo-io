'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, Loader2, Search, FileSearch, Trash2, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { notifyAuditStarted } from '@/hooks/use-active-audit'
import { formatDuration, calculateDuration, formatAuditDate, getDomain } from '@/lib/utils'
import { deleteUnifiedAudit } from '@/app/(authenticated)/[orgId]/seo/audit/actions'
import type { UnifiedAudit } from '@/lib/unified-audit/types'

function isInProgress(status: string): boolean {
  return (
    status === 'pending' ||
    status === 'crawling' ||
    status === 'checking' ||
    status === 'batch_complete' ||
    status === 'awaiting_confirmation'
  )
}

interface QuickAuditClientProps {
  audits: UnifiedAudit[]
}

export function QuickAuditClient({ audits }: QuickAuditClientProps) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAudits = useMemo(() => {
    if (!searchQuery.trim()) return audits
    const query = searchQuery.toLowerCase()
    return audits.filter(
      (a) => a.url.toLowerCase().includes(query) || a.domain.toLowerCase().includes(query)
    )
  }, [audits, searchQuery])

  const handleRunAudit = async (auditUrl?: string) => {
    const targetUrl = auditUrl || url.trim()
    if (!targetUrl) {
      setError('Please enter a URL')
      return
    }

    let normalizedUrl = targetUrl
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    try {
      new URL(normalizedUrl)
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/unified-audit/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl, organizationId: null }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to start audit')
      }

      const data = await response.json()
      notifyAuditStarted()
      router.push(`/quick-audit/${data.auditId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAudit = async (auditId: string) => {
    const result = await deleteUnifiedAudit(auditId)
    if (!result.error) {
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-neutral-500" />
            <CardTitle className="text-base">Run Full Site Audit</CardTitle>
          </div>
          <CardDescription>
            Comprehensive analysis covering SEO, Performance, and AI Readiness in a single audit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="url" className="sr-only">
                URL
              </Label>
              <Input
                id="url"
                data-testid="quick-audit-url-input"
                placeholder="example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && url.trim()) {
                    e.preventDefault()
                    handleRunAudit()
                  }
                }}
              />
            </div>
            <Button
              data-testid="quick-audit-run-button"
              onClick={() => handleRunAudit()}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Run Audit'
              )}
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" data-testid="quick-audit-error">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Audit History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Audit History</CardTitle>
              <CardDescription>One-time audits not associated with an organization</CardDescription>
            </div>
            {audits.length > 0 && (
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
                    <span className="max-w-[200px] truncate text-sm font-medium">
                      {getDomain(audit.url)}
                    </span>
                    {isInProgress(audit.status) ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                        <Badge variant="outline">In Progress</Badge>
                      </div>
                    ) : (
                      <span className="font-medium tabular-nums">
                        {audit.status === 'failed'
                          ? '00/100'
                          : audit.overall_score !== null
                            ? `${audit.overall_score}/100`
                            : '-'}
                      </span>
                    )}
                    <span className="text-muted-foreground text-sm">
                      {audit.pages_crawled} {audit.pages_crawled === 1 ? 'page' : 'pages'}
                    </span>
                    {audit.status === 'failed' && (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Failed</Badge>
                        {audit.error_message && (
                          <span className="text-xs text-red-600">{audit.error_message}</span>
                        )}
                      </div>
                    )}
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
                      <Link href={`/quick-audit/${audit.id}`}>View</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunAudit(audit.url)}
                      disabled={loading || isInProgress(audit.status)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Re-run audit"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
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
