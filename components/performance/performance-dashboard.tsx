'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Gauge, Loader2, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import type { PerformanceAudit, MonitoredPage } from '@/lib/performance/types'
import { formatDate } from '@/lib/utils'

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

  const handleAddPage = async () => {
    setError(null)
    if (!newUrl.trim()) return

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
          <div className="flex gap-2">
            <label htmlFor="new-page-url" className="sr-only">
              Page URL to monitor
            </label>
            <Input
              id="new-page-url"
              placeholder="https://example.com/page"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPage()}
            />
            <Button onClick={handleAddPage} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
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
            <div className="space-y-2">
              {audits.map((audit) => (
                <a
                  key={audit.id}
                  href={`/audit/performance/${audit.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between rounded-md border px-4 py-3 transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium">
                      {audit.completed_at
                        ? formatDate(audit.completed_at, false)
                        : formatDate(audit.created_at, false)}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      audit.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : audit.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {audit.status}
                  </span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
