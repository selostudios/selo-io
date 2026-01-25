'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScoreCards } from './score-cards'
import { CheckList } from './check-list'
import { ResourceList } from './resource-list'
import type { SiteAudit, SiteAuditCheck, SiteAuditPage, DismissedCheck } from '@/lib/audit/types'
import { formatDate, formatDuration, calculateDuration } from '@/lib/utils'
import { useState, useEffect, useCallback, useMemo } from 'react'

interface AuditReportProps {
  audit: SiteAudit
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
}

type StatusFilter = 'all' | 'failed' | 'warning' | 'passed'

export function AuditReport({ audit, checks, pages }: AuditReportProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dismissedChecks, setDismissedChecks] = useState<DismissedCheck[]>([])

  // Fetch dismissed checks on mount
  useEffect(() => {
    fetch('/api/audit/dismiss')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDismissedChecks(data)
        }
      })
      .catch((err) => console.error('[Fetch Dismissed Checks Error]', err))
  }, [])

  // Create a map of page_id to page URL for looking up dismissed checks
  const pageMap = useMemo(() => new Map(pages.map((p) => [p.id, p.url])), [pages])

  // Filter out dismissed checks
  const isDismissed = useCallback(
    (check: SiteAuditCheck) => {
      const pageUrl = check.page_id ? pageMap.get(check.page_id) : audit.url
      return dismissedChecks.some((d) => d.check_name === check.check_name && d.url === pageUrl)
    },
    [dismissedChecks, pageMap, audit.url]
  )

  const visibleChecks = checks.filter((c) => !isDismissed(c))

  // Filter by search query
  const searchFilteredChecks = useMemo(() => {
    if (!searchQuery.trim()) return visibleChecks
    const query = searchQuery.toLowerCase()
    return visibleChecks.filter((c) => {
      const displayName = c.display_name?.toLowerCase() || ''
      const checkName = c.check_name.toLowerCase()
      return displayName.includes(query) || checkName.includes(query)
    })
  }, [visibleChecks, searchQuery])

  // Handle dismiss action
  const handleDismissCheck = useCallback(async (checkName: string, url: string) => {
    const response = await fetch('/api/audit/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_name: checkName, url }),
    })

    if (response.ok) {
      const dismissed = await response.json()
      setDismissedChecks((prev) => [...prev, dismissed])
    }
  }, [])

  // Group checks by type (using search-filtered checks)
  const seoChecks = searchFilteredChecks.filter((c) => c.check_type === 'seo')
  const aiChecks = searchFilteredChecks.filter((c) => c.check_type === 'ai_readiness')
  const technicalChecks = searchFilteredChecks.filter((c) => c.check_type === 'technical')

  // Separate HTML pages from resources
  const htmlPages = pages.filter((p) => !p.is_resource)
  const resourcePages = pages.filter((p) => p.is_resource)

  // Count by status (using search-filtered checks)
  const failedCount = searchFilteredChecks.filter((c) => c.status === 'failed').length
  const warningCount = searchFilteredChecks.filter((c) => c.status === 'warning').length
  const passedCount = searchFilteredChecks.filter((c) => c.status === 'passed').length

  // Filter checks based on active filter
  const filterChecks = (checkList: SiteAuditCheck[]) => {
    if (activeFilter === 'all') return checkList
    return checkList.filter((c) => c.status === activeFilter)
  }

  // Extract domain from URL for display
  const displayUrl = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/audit"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audits
        </Link>
        <Button variant="outline" asChild>
          <a href={`/api/audit/${audit.id}/export`} download>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </a>
        </Button>
      </div>

      {/* Site Info */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-balance">{displayUrl}</h1>
          {audit.status === 'stopped' && (
            <Badge variant="secondary" className="text-xs">
              Partial Report
            </Badge>
          )}
          {audit.status === 'failed' && (
            <Badge variant="destructive" className="text-xs">
              Failed
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {audit.status === 'stopped' ? 'Stopped' : 'Audited'}{' '}
          {audit.completed_at ? formatDate(audit.completed_at, false) : 'In progress'} &middot;{' '}
          {audit.pages_crawled} page{audit.pages_crawled !== 1 ? 's' : ''} crawled
          {(() => {
            const duration = calculateDuration(audit.started_at, audit.completed_at)
            return duration ? ` · ${formatDuration(duration)}` : ''
          })()}
        </p>
        {audit.status === 'stopped' && (
          <p className="mt-1 text-sm text-yellow-600">
            This audit was stopped early. Results are based on {audit.pages_crawled} pages analyzed.
          </p>
        )}
      </div>

      {/* Executive Summary */}
      {audit.executive_summary && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-lg font-semibold">Executive Summary</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {audit.executive_summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Score Cards */}
      <ScoreCards
        overall={audit.overall_score}
        seo={audit.seo_score}
        ai={audit.ai_readiness_score}
        technical={audit.technical_score}
      />

      {/* Search and Status Filter Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search checks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-48 pl-8 pr-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Badge
          variant={activeFilter === 'all' ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setActiveFilter('all')}
        >
          All ({searchFilteredChecks.length})
        </Badge>
        <Badge
          variant={activeFilter === 'failed' ? 'destructive' : 'outline'}
          className={failedCount === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          onClick={() => failedCount > 0 && setActiveFilter('failed')}
        >
          Failed ({failedCount})
        </Badge>
        <Badge
          variant={activeFilter === 'warning' ? 'warning' : 'outline'}
          className={warningCount === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          onClick={() => warningCount > 0 && setActiveFilter('warning')}
        >
          Warnings ({warningCount})
        </Badge>
        <Badge
          variant={activeFilter === 'passed' ? 'success' : 'outline'}
          className={passedCount === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          onClick={() => passedCount > 0 && setActiveFilter('passed')}
        >
          Passed ({passedCount})
        </Badge>
      </div>

      {/* Check Lists */}
      <div className="space-y-4 rounded-lg border p-4">
        <CheckList
          title="SEO Issues"
          checks={filterChecks(seoChecks)}
          pages={htmlPages}
          onDismissCheck={handleDismissCheck}
        />
        <CheckList
          title="AI-Readiness Issues"
          checks={filterChecks(aiChecks)}
          pages={htmlPages}
          onDismissCheck={handleDismissCheck}
        />
        <CheckList
          title="Technical Issues"
          checks={filterChecks(technicalChecks)}
          pages={htmlPages}
          onDismissCheck={handleDismissCheck}
        />
        <ResourceList resources={resourcePages} baseUrl={audit.url} />
      </div>
    </div>
  )
}
