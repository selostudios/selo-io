'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/ui/empty-state'
import { CheckItem } from './check-item'
import type { SiteAuditCheck, SiteAuditPage } from '@/lib/audit/types'
import {
  CheckCircle,
  ChevronDown,
  ChevronsUpDown,
  ExternalLink,
  FileText,
  Gauge,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CheckStatus } from '@/lib/enums'

interface CheckListProps {
  title: string
  checks: SiteAuditCheck[]
  pages: SiteAuditPage[]
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
}

function sortChecks(checks: SiteAuditCheck[]): SiteAuditCheck[] {
  return [...checks].sort((a, b) => {
    const statusOrder = { failed: 0, warning: 1, passed: 2 }
    const priorityOrder = { critical: 0, recommended: 1, optional: 2 }

    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff

    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

function formatPagePath(url: string): string {
  try {
    const pageUrl = new URL(url)
    // Show domain + pathname (without protocol)
    return pageUrl.host + (pageUrl.pathname || '/')
  } catch {
    return url
  }
}

function formatLastModified(lastModified: string | null): string | null {
  if (!lastModified) return null
  try {
    const date = new Date(lastModified)
    if (isNaN(date.getTime())) return null
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return null
  }
}

export function CheckList({ title, checks, pages, onDismissCheck }: CheckListProps) {
  const failedCount = checks.filter((c) => c.status === CheckStatus.Failed).length
  const warningCount = checks.filter((c) => c.status === CheckStatus.Warning).length
  const passedCount = checks.filter((c) => c.status === CheckStatus.Passed).length

  // Create a map of page_id to page for quick lookup
  const pageMap = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])

  // Get base URL from first page
  const baseUrl = pages[0]?.url || ''

  // Separate site-wide checks from page-specific checks
  const siteWideChecks = checks.filter((c) => c.is_site_wide)
  const pageSpecificChecks = checks.filter((c) => !c.is_site_wide)

  // Deduplicate site-wide checks (they may appear multiple times)
  const uniqueSiteWideChecks = Array.from(
    new Map(siteWideChecks.map((c) => [c.check_name, c])).values()
  )

  // Group page-specific checks by page_id
  const checksByPage = useMemo(() => {
    const map = new Map<string | null, SiteAuditCheck[]>()
    for (const check of pageSpecificChecks) {
      const pageId = check.page_id
      const existing = map.get(pageId) || []
      existing.push(check)
      map.set(pageId, existing)
    }
    return map
  }, [pageSpecificChecks])

  const siteWideFailedCount = uniqueSiteWideChecks.filter((c) => c.status === CheckStatus.Failed).length

  // Sort page groups: pages with failed checks first, then by URL
  // Memoize to satisfy React Compiler
  const sortedPageIds = useMemo(() => {
    return Array.from(checksByPage.keys()).sort((a, b) => {
      const aChecks = checksByPage.get(a) || []
      const bChecks = checksByPage.get(b) || []
      const aHasFailed = aChecks.some((c) => c.status === CheckStatus.Failed)
      const bHasFailed = bChecks.some((c) => c.status === CheckStatus.Failed)

      if (aHasFailed && !bHasFailed) return -1
      if (!aHasFailed && bHasFailed) return 1

      // Sort by URL
      const aUrl = a ? pageMap.get(a)?.url || '' : ''
      const bUrl = b ? pageMap.get(b)?.url || '' : ''
      return aUrl.localeCompare(bUrl)
    })
  }, [checksByPage, pageMap])

  // Build list of all collapsible IDs (site-wide + page IDs)
  const allCollapsibleIds = useMemo(() => {
    const ids: string[] = []
    if (uniqueSiteWideChecks.length > 0) {
      ids.push('site-wide')
    }
    for (const pageId of sortedPageIds) {
      ids.push(pageId || 'general')
    }
    return ids
  }, [uniqueSiteWideChecks.length, sortedPageIds])

  // Initialize open state: pages with failed checks start open
  const [openStates, setOpenStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    if (uniqueSiteWideChecks.length > 0) {
      initial['site-wide'] = siteWideFailedCount > 0
    }
    for (const pageId of sortedPageIds) {
      const pageChecks = checksByPage.get(pageId) || []
      const hasFailed = pageChecks.some((c) => c.status === CheckStatus.Failed)
      initial[pageId || 'general'] = hasFailed
    }
    return initial
  })

  const handleToggle = (id: string, open: boolean) => {
    setOpenStates((prev) => ({ ...prev, [id]: open }))
  }

  const allExpanded =
    allCollapsibleIds.length > 0 && allCollapsibleIds.every((id) => openStates[id])

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newState = !allExpanded
    const newStates: Record<string, boolean> = {}
    for (const id of allCollapsibleIds) {
      newStates[id] = newState
    }
    setOpenStates(newStates)
  }

  return (
    <Collapsible defaultOpen className="group/list">
      <div className="bg-background flex w-full items-center justify-between rounded-md px-4 py-3">
        <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/list:-rotate-90'
            )}
          />
          <span className="text-lg font-semibold">{title}</span>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 text-sm">
          {failedCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 tabular-nums">
              {failedCount} failed
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700 tabular-nums">
              {warningCount} warnings
            </span>
          )}
          {passedCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 tabular-nums">
              {passedCount} passed
            </span>
          )}
          {allCollapsibleIds.length > 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleAll}
                  className="text-muted-foreground hover:text-foreground ml-2 cursor-pointer rounded p-1 transition-colors"
                  aria-label={allExpanded ? 'Collapse all pages' : 'Expand all pages'}
                >
                  <ChevronsUpDown className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{allExpanded ? 'Collapse all' : 'Expand all'}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
      <CollapsibleContent className="mt-2 space-y-3 pl-4">
        {/* Site-wide issues section */}
        {uniqueSiteWideChecks.length > 0 && (
          <Collapsible
            open={openStates['site-wide'] ?? false}
            onOpenChange={(open) => handleToggle('site-wide', open)}
            className="group/page border-b pb-3"
          >
            <CollapsibleTrigger className="hover:bg-muted/30 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left transition-colors">
              <ChevronDown
                className={cn(
                  'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                  'group-data-[state=closed]/page:-rotate-90'
                )}
              />
              <Globe className="text-muted-foreground size-4 shrink-0" />
              <span className="text-sm font-medium">Site-wide</span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                {uniqueSiteWideChecks.length} check{uniqueSiteWideChecks.length !== 1 ? 's' : ''}
                {siteWideFailedCount > 0 && (
                  <span className="ml-1 text-red-600">({siteWideFailedCount} failed)</span>
                )}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 ml-6 space-y-1">
              {sortChecks(uniqueSiteWideChecks).map((check) => (
                <CheckItem
                  key={check.id}
                  check={check}
                  pageUrl={baseUrl}
                  onDismiss={onDismissCheck}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Page-specific issues */}
        {sortedPageIds.map((pageId) => {
          const pageChecks = sortChecks(checksByPage.get(pageId) || [])
          const page = pageId ? pageMap.get(pageId) : null
          const pagePath = page ? formatPagePath(page.url) : 'General'
          const pageFailedCount = pageChecks.filter((c) => c.status === CheckStatus.Failed).length

          const collapsibleId = pageId || 'general'

          return (
            <Collapsible
              key={collapsibleId}
              open={openStates[collapsibleId] ?? false}
              onOpenChange={(open) => handleToggle(collapsibleId, open)}
              className="group/page border-b pb-3 last:border-b-0"
            >
              <CollapsibleTrigger className="hover:bg-muted/30 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left transition-colors">
                <ChevronDown
                  className={cn(
                    'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                    'group-data-[state=closed]/page:-rotate-90'
                  )}
                />
                <FileText className="text-muted-foreground size-4 shrink-0" />
                {page?.url ? (
                  <>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-w-0 items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
                      title={page.url}
                    >
                      <span className="truncate">{pagePath}</span>
                      <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                    </a>
                    {page.last_modified && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="text-muted-foreground shrink-0 cursor-help text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatLastModified(page.last_modified)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Estimated last update based on HTTP headers and sitemap data. May not
                          reflect actual content changes.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  <span className="truncate text-sm font-medium">{pagePath}</span>
                )}
                <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                  {pageChecks.length} check{pageChecks.length !== 1 ? 's' : ''}
                  {pageFailedCount > 0 && (
                    <span className="ml-1 text-red-600">({pageFailedCount} failed)</span>
                  )}
                </span>
                {page?.url && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={`/audit/performance?url=${encodeURIComponent(page.url)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground ml-0.5 shrink-0 cursor-pointer rounded p-1 transition-colors"
                        aria-label="Run performance audit for this page"
                      >
                        <Gauge className="size-5" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Run performance audit</TooltipContent>
                  </Tooltip>
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-6 space-y-1">
                {pageChecks.map((check) => (
                  <CheckItem
                    key={check.id}
                    check={check}
                    pageUrl={page?.url}
                    onDismiss={onDismissCheck}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )
        })}
        {checks.length === 0 && (
          <EmptyState icon={CheckCircle} title="No checks in this category" className="py-4" />
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
