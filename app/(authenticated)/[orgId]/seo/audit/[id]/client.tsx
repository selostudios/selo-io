'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, ExternalLink, Share2, Search, X, Loader2 } from 'lucide-react'
import { useBuildOrgHref } from '@/hooks/use-org-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShareModal } from '@/components/share/share-modal'
import { UnifiedScoreCards } from '@/components/audit/unified-score-cards'
import { UnifiedCheckList } from '@/components/audit/unified-check-list'
import { getUnifiedAuditChecksByTab, rerunCheck } from './actions'
import { SharedResourceType, UnifiedAuditStatus, CheckStatus } from '@/lib/enums'
import { formatDate, formatDuration, calculateDuration } from '@/lib/utils'
import type { UnifiedAudit, AuditCheck } from '@/lib/unified-audit/types'
import type { TabCounts } from './actions'

type TabActionKey = 'overview' | 'seo' | 'performance' | 'ai_readiness'
type FetchChecksFn = (auditId: string, tab: TabActionKey) => Promise<AuditCheck[]>

interface UnifiedAuditDetailClientProps {
  audit: UnifiedAudit
  tabCounts: TabCounts
  fetchChecks?: FetchChecksFn
}

type StatusFilter = 'all' | 'failed' | 'warning' | 'passed'
type TabValue = 'overview' | 'seo' | 'performance' | 'ai-readiness'

// Map tab values to the action parameter format
const TAB_TO_ACTION_KEY: Record<TabValue, 'overview' | 'seo' | 'performance' | 'ai_readiness'> = {
  overview: 'overview',
  seo: 'seo',
  performance: 'performance',
  'ai-readiness': 'ai_readiness',
}

// Map tab values to tabCounts keys
const TAB_TO_COUNTS_KEY: Record<TabValue, keyof TabCounts> = {
  overview: 'overview',
  seo: 'seo',
  performance: 'performance',
  'ai-readiness': 'aiReadiness',
}

export function UnifiedAuditDetailClient({
  audit,
  tabCounts,
  fetchChecks,
}: UnifiedAuditDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const buildOrgHref = useBuildOrgHref()
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Tab state synced with URL
  const currentTab = (searchParams.get('tab') as TabValue) || 'overview'

  // Cached checks per tab
  const [checksByTab, setChecksByTab] = useState<Partial<Record<TabValue, AuditCheck[]>>>({})
  const [loadingTab, setLoadingTab] = useState<TabValue | null>(null)
  const fetchingRef = useRef<TabValue | null>(null)

  const fetcher = fetchChecks ?? getUnifiedAuditChecksByTab

  // Fetch checks for a tab if not already cached
  const fetchChecksForTab = useCallback(
    async (tab: TabValue) => {
      if (checksByTab[tab] || fetchingRef.current === tab) return
      fetchingRef.current = tab
      setLoadingTab(tab)
      try {
        const checks = await fetcher(audit.id, TAB_TO_ACTION_KEY[tab])
        setChecksByTab((prev) => ({ ...prev, [tab]: checks }))
      } catch (err) {
        console.error('[Fetch Tab Checks Error]', {
          type: 'tab_fetch_failed',
          tab,
          auditId: audit.id,
          error: err,
          timestamp: new Date().toISOString(),
        })
      } finally {
        setLoadingTab(null)
        fetchingRef.current = null
      }
    },
    [audit.id, checksByTab, fetcher]
  )

  // Fetch checks for the current tab on mount and tab change
  useEffect(() => {
    fetchChecksForTab(currentTab)
  }, [currentTab, fetchChecksForTab])

  const handleTabChange = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const handleRerunCheck = useCallback(
    async (checkName: string, pageUrls: string[]) => {
      const result = await rerunCheck(audit.id, checkName, pageUrls)
      if (result.success) {
        // Invalidate cache for current tab so it re-fetches
        setChecksByTab((prev) => {
          const next = { ...prev }
          delete next[currentTab]
          return next
        })
        router.refresh()
      }
      return { passed: result.passed, failed: result.failed, warnings: result.warnings }
    },
    [audit.id, router, currentTab]
  )

  const currentChecks = useMemo(() => checksByTab[currentTab] ?? [], [checksByTab, currentTab])
  const isLoading = loadingTab === currentTab && !checksByTab[currentTab]

  // Filter checks by search query
  const searchFilteredChecks = useMemo(() => {
    if (!searchQuery.trim()) return currentChecks
    const query = searchQuery.toLowerCase()
    return currentChecks.filter((c) => {
      const displayName = c.display_name?.toLowerCase() || ''
      const checkName = c.check_name.toLowerCase()
      return displayName.includes(query) || checkName.includes(query)
    })
  }, [currentChecks, searchQuery])

  // Filter by status
  const statusFilteredChecks = useMemo(() => {
    if (activeFilter === 'all') return searchFilteredChecks
    return searchFilteredChecks.filter((c) => c.status === activeFilter)
  }, [searchFilteredChecks, activeFilter])

  // Counts for filter badges from loaded checks
  const { failedCount, warningCount, passedCount } = useMemo(() => {
    let failed = 0,
      warning = 0,
      passed = 0
    for (const c of searchFilteredChecks) {
      if (c.status === CheckStatus.Failed) failed++
      else if (c.status === CheckStatus.Warning) warning++
      else if (c.status === CheckStatus.Passed) passed++
    }
    return { failedCount: failed, warningCount: warning, passedCount: passed }
  }, [searchFilteredChecks])

  // Tab counts from server — static, don't change with filters
  const currentTabCounts = tabCounts[TAB_TO_COUNTS_KEY[currentTab]]

  const displayUrl = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href={buildOrgHref('/seo/audit')}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Audits
          </Link>
          <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Site Info */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold" data-testid="audit-report-title">
              Audit Results:
            </h1>
            <a
              href={audit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-2xl font-bold hover:underline"
            >
              {displayUrl}
              <ExternalLink className="text-muted-foreground size-5" />
            </a>
            {audit.status === UnifiedAuditStatus.Stopped && (
              <Badge variant="secondary" className="text-xs">
                Partial Report
              </Badge>
            )}
            {audit.status === UnifiedAuditStatus.Failed && (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            )}
          </div>
          {audit.status === UnifiedAuditStatus.Failed && audit.error_message && (
            <p className="text-sm text-red-600">{audit.error_message}</p>
          )}
          <p className="text-muted-foreground text-sm">
            {audit.status === UnifiedAuditStatus.Stopped ? 'Stopped' : 'Audited'}{' '}
            {audit.completed_at ? formatDate(audit.completed_at, false) : 'In progress'} &middot;{' '}
            {audit.pages_crawled} page{audit.pages_crawled !== 1 ? 's' : ''} crawled
            {(() => {
              const duration = calculateDuration(audit.started_at, audit.completed_at)
              return duration ? ` · ${formatDuration(duration)}` : ''
            })()}
          </p>
        </div>

        {/* Score Cards */}
        <UnifiedScoreCards
          overall={audit.overall_score}
          seo={audit.seo_score}
          performance={audit.performance_score}
          aiReadiness={audit.ai_readiness_score}
        />

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={activeFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setActiveFilter('all')}
          >
            All ({isLoading ? currentTabCounts.total : searchFilteredChecks.length})
          </Badge>
          <Badge
            variant={activeFilter === 'failed' ? 'destructive' : 'outline'}
            className={
              (isLoading ? currentTabCounts.failed : failedCount) === 0
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }
            onClick={() =>
              (isLoading ? currentTabCounts.failed : failedCount) > 0 && setActiveFilter('failed')
            }
          >
            Failed ({isLoading ? currentTabCounts.failed : failedCount})
          </Badge>
          <Badge
            variant={activeFilter === 'warning' ? 'warning' : 'outline'}
            className={
              (isLoading ? currentTabCounts.warning : warningCount) === 0
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }
            onClick={() =>
              (isLoading ? currentTabCounts.warning : warningCount) > 0 &&
              setActiveFilter('warning')
            }
          >
            Warnings ({isLoading ? currentTabCounts.warning : warningCount})
          </Badge>
          <Badge
            variant={activeFilter === 'passed' ? 'success' : 'outline'}
            className={
              (isLoading ? currentTabCounts.passed : passedCount) === 0
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer'
            }
            onClick={() =>
              (isLoading ? currentTabCounts.passed : passedCount) > 0 && setActiveFilter('passed')
            }
          >
            Passed ({isLoading ? currentTabCounts.passed : passedCount})
          </Badge>
          <div className="relative ml-auto">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search checks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-48 pr-8 pl-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs value={currentTab} onValueChange={handleTabChange} data-testid="audit-tabs">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="seo" data-testid="tab-seo">
              SEO ({tabCounts.seo.total})
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              Performance ({tabCounts.performance.total})
            </TabsTrigger>
            <TabsTrigger value="ai-readiness" data-testid="tab-ai-readiness">
              AI Readiness ({tabCounts.aiReadiness.total})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={currentTab} className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground size-6 animate-spin" />
              </div>
            ) : (
              <UnifiedCheckList
                checks={statusFilteredChecks}
                groupBy="category"
                totalPages={audit.pages_crawled}
                onRerunCheck={handleRerunCheck}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        resourceType={SharedResourceType.UnifiedAudit}
        resourceId={audit.id}
      />
    </>
  )
}
