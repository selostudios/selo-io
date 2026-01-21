'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Clock, Gauge, Loader2, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'
import { formatDuration, calculateDuration } from '@/lib/utils'

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

interface PerformanceDashboardProps {
  audits: PerformanceAudit[]
  monitoredPages: MonitoredPage[]
  websiteUrl: string
  initialUrl?: string
}

export function PerformanceDashboard({
  audits,
  monitoredPages: initialPages,
  websiteUrl,
  initialUrl,
}: PerformanceDashboardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [monitoredPages, setMonitoredPages] = useState(initialPages)
  const [newUrl, setNewUrl] = useState(initialUrl ?? '')

  const handleRunAudit = () => {
    setError(null)

    // Collect URLs: homepage + monitored pages
    const urls = [websiteUrl, ...monitoredPages.map((p) => p.url)]
    const uniqueUrls = [...new Set(urls)]

    startTransition(async () => {
      try {
        const response = await fetch('/api/performance/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: uniqueUrls }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Failed to start audit')
          return
        }

        const data = await response.json()
        router.push(`/audit/performance/${data.auditId}`)
      } catch (err) {
        console.error('[Performance Dashboard] Failed to start audit:', err)
        setError('Failed to start audit')
      }
    })
  }

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return false
    try {
      const parsed = new URL(url.trim())
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch {
      return false
    }
  }

  const normalizeUrl = (url: string): string => {
    try {
      const parsed = new URL(url.trim())
      // Normalize: lowercase host, remove trailing slash from path
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/$/, '') || '/'}`
    } catch {
      return url.trim().toLowerCase()
    }
  }

  const isDuplicateUrl = (url: string): boolean => {
    const normalized = normalizeUrl(url)
    const normalizedWebsiteUrl = normalizeUrl(websiteUrl)
    // Check if it matches the homepage
    if (normalized === normalizedWebsiteUrl) return true
    // Check if it's already in monitored pages
    return monitoredPages.some((p) => normalizeUrl(p.url) === normalized)
  }

  const canAddPage = isValidUrl(newUrl) && !isDuplicateUrl(newUrl)

  const handleAddPage = async () => {
    setError(null)
    if (!canAddPage) return

    try {
      const response = await fetch('/api/performance/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to add page')
        return
      }

      const page = await response.json()
      setMonitoredPages((prev) => [page, ...prev])
      setNewUrl('')
    } catch (err) {
      console.error('[Performance Dashboard] Failed to add page:', err)
      setError('Failed to add page')
    }
  }

  const handleRemovePage = async (id: string) => {
    try {
      const response = await fetch(`/api/performance/pages?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        setMonitoredPages((prev) => prev.filter((p) => p.id !== id))
      }
    } catch (err) {
      console.error('[Performance Dashboard] Failed to remove page:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Run Audit Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Run Performance Audit</CardTitle>
              <CardDescription>
                Test {1 + monitoredPages.length} page{monitoredPages.length !== 0 ? 's' : ''} with
                PageSpeed Insights
              </CardDescription>
            </div>
            <Button onClick={handleRunAudit} disabled={isPending}>
              {isPending ? (
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
            <p role="alert" aria-live="polite" className="text-destructive mt-2 text-sm">
              {error}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Monitored Pages */}
      <Card>
        <CardHeader>
          <CardTitle>Monitored Pages</CardTitle>
          <CardDescription>
            Pages to include in performance audits. Homepage is always included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new page */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <label htmlFor="new-page-url" className="sr-only">
                Page URL to monitor
              </label>
              <Input
                id="new-page-url"
                placeholder="https://example.com/page"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canAddPage && handleAddPage()}
              />
              <Button onClick={handleAddPage} variant="outline" disabled={!canAddPage}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
            {isValidUrl(newUrl) && isDuplicateUrl(newUrl) && (
              <p className="text-muted-foreground text-sm">
                This page is already being monitored.
              </p>
            )}
          </div>

          {/* Homepage (always included) */}
          <div className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2">
            <span className="text-sm">{websiteUrl}</span>
            <span className="text-muted-foreground text-xs">Homepage (always included)</span>
          </div>

          {/* Monitored pages list */}
          {monitoredPages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="truncate text-sm">{page.url}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemovePage(page.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${page.url} from monitoring`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Audit History */}
      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          {audits.length === 0 ? (
            <EmptyState
              icon={Gauge}
              title="No audits yet"
              description="Run your first performance audit above."
            />
          ) : (
            <div className="divide-y">
              {audits.map((audit) => (
                <div
                  key={audit.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground w-28 text-sm">
                      {formatAuditDate(audit.created_at)}
                    </span>
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
                        {audit.total_urls} {audit.total_urls === 1 ? 'page' : 'pages'}
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
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/audit/performance/${audit.id}`}>View</Link>
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
