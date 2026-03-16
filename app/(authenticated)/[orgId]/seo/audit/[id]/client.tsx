'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, ExternalLink, Share2, Search, X } from 'lucide-react'
import { useBuildOrgHref } from '@/hooks/use-org-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShareModal } from '@/components/share/share-modal'
import { UnifiedScoreCards } from '@/components/audit/unified-score-cards'
import { UnifiedCheckList } from '@/components/audit/unified-check-list'
import { rerunCheck } from './actions'
import { SharedResourceType, UnifiedAuditStatus, CheckStatus, ScoreDimension } from '@/lib/enums'
import { formatDate, formatDuration, calculateDuration } from '@/lib/utils'
import type { UnifiedAudit, AuditCheck, AuditPage } from '@/lib/unified-audit/types'

interface UnifiedAuditDetailClientProps {
  audit: UnifiedAudit
  checks: AuditCheck[]
  pages: AuditPage[]
}

type StatusFilter = 'all' | 'failed' | 'warning' | 'passed'
type TabValue = 'overview' | 'seo' | 'performance' | 'ai-readiness'

export function UnifiedAuditDetailClient({ audit, checks }: UnifiedAuditDetailClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const buildOrgHref = useBuildOrgHref()
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Tab state synced with URL
  const currentTab = (searchParams.get('tab') as TabValue) || 'overview'

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
        router.refresh()
      }
      return { passed: result.passed, failed: result.failed, warnings: result.warnings }
    },
    [audit.id, router]
  )

  // Filter checks by search query
  const searchFilteredChecks = useMemo(() => {
    if (!searchQuery.trim()) return checks
    const query = searchQuery.toLowerCase()
    return checks.filter((c) => {
      const displayName = c.display_name?.toLowerCase() || ''
      const checkName = c.check_name.toLowerCase()
      return displayName.includes(query) || checkName.includes(query)
    })
  }, [checks, searchQuery])

  // Filter by status
  const statusFilteredChecks = useMemo(() => {
    if (activeFilter === 'all') return searchFilteredChecks
    return searchFilteredChecks.filter((c) => c.status === activeFilter)
  }, [searchFilteredChecks, activeFilter])

  // Score-filtered checks for tabs
  const seoChecks = useMemo(
    () => statusFilteredChecks.filter((c) => c.feeds_scores.includes(ScoreDimension.SEO)),
    [statusFilteredChecks]
  )
  const performanceChecks = useMemo(
    () => statusFilteredChecks.filter((c) => c.feeds_scores.includes(ScoreDimension.Performance)),
    [statusFilteredChecks]
  )
  const aiChecks = useMemo(
    () => statusFilteredChecks.filter((c) => c.feeds_scores.includes(ScoreDimension.AIReadiness)),
    [statusFilteredChecks]
  )

  // Counts for filter badges
  const failedCount = searchFilteredChecks.filter((c) => c.status === CheckStatus.Failed).length
  const warningCount = searchFilteredChecks.filter((c) => c.status === CheckStatus.Warning).length
  const passedCount = searchFilteredChecks.filter((c) => c.status === CheckStatus.Passed).length

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
              SEO ({seoChecks.length})
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              Performance ({performanceChecks.length})
            </TabsTrigger>
            <TabsTrigger value="ai-readiness" data-testid="tab-ai-readiness">
              AI Readiness ({aiChecks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <UnifiedCheckList
              checks={statusFilteredChecks}
              groupBy="category"
              totalPages={audit.pages_crawled}
              onRerunCheck={handleRerunCheck}
            />
          </TabsContent>

          <TabsContent value="seo" className="space-y-4">
            <UnifiedCheckList
              checks={seoChecks}
              groupBy="category"
              totalPages={audit.pages_crawled}
              onRerunCheck={handleRerunCheck}
            />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <UnifiedCheckList
              checks={performanceChecks}
              groupBy="category"
              totalPages={audit.pages_crawled}
              onRerunCheck={handleRerunCheck}
            />
          </TabsContent>

          <TabsContent value="ai-readiness" className="space-y-4">
            <UnifiedCheckList
              checks={aiChecks}
              groupBy="category"
              totalPages={audit.pages_crawled}
              onRerunCheck={handleRerunCheck}
            />
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
