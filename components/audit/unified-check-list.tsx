'use client'

import { useState, useMemo } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  CheckCircle,
  Globe,
  ExternalLink,
  Info,
  Flag,
  Loader2,
  RotateCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { CheckStatus, CheckCategory } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'

// =============================================================================
// Category Labels
// =============================================================================

const categoryLabels: Record<string, string> = {
  [CheckCategory.Crawlability]: 'Crawlability',
  [CheckCategory.MetaContent]: 'Meta Content',
  [CheckCategory.ContentStructure]: 'Content Structure',
  [CheckCategory.ContentQuality]: 'Content Quality',
  [CheckCategory.Links]: 'Links',
  [CheckCategory.Media]: 'Media',
  [CheckCategory.StructuredData]: 'Structured Data',
  [CheckCategory.Security]: 'Security',
  [CheckCategory.Performance]: 'Performance',
  [CheckCategory.AIVisibility]: 'AI Visibility',
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusIcon(status: string): string {
  if (status === CheckStatus.Passed) return '✓'
  if (status === CheckStatus.Warning) return '⚠'
  return '✗'
}

function getStatusColor(status: string): string {
  if (status === CheckStatus.Passed) return 'text-green-600'
  if (status === CheckStatus.Warning) return 'text-yellow-600'
  return 'text-red-600'
}

function getDisplayName(check: AuditCheck): string {
  if (check.status === CheckStatus.Passed && check.display_name_passed) {
    return check.display_name_passed
  }
  return check.display_name || check.check_name.replace(/-/g, ' ')
}

function getDetailMessage(details: Record<string, unknown> | null): string | null {
  if (!details) return null
  if (typeof details.message === 'string') return details.message
  if (typeof details.description === 'string') return details.description
  return null
}

/**
 * Extract affected URLs from site-wide check details.
 * Supports: details.duplicates[].urls, details.affectedUrls, details.urls
 */
function extractAffectedUrls(details: Record<string, unknown> | null): string[] {
  if (!details) return []

  // Handle duplicates format (duplicate-titles, duplicate-meta-descriptions)
  if (Array.isArray(details.duplicates)) {
    const urls: string[] = []
    for (const group of details.duplicates) {
      if (
        group &&
        typeof group === 'object' &&
        Array.isArray((group as Record<string, unknown>).urls)
      ) {
        for (const url of (group as Record<string, unknown>).urls as string[]) {
          if (typeof url === 'string' && !urls.includes(url)) urls.push(url)
        }
      }
    }
    return urls
  }

  // Handle flat URL arrays
  if (Array.isArray(details.affectedUrls)) {
    return details.affectedUrls.filter((u): u is string => typeof u === 'string')
  }
  if (Array.isArray(details.urls)) {
    return details.urls.filter((u): u is string => typeof u === 'string')
  }

  return []
}

function formatPagePath(url: string): string {
  try {
    const pageUrl = new URL(url)
    const path = pageUrl.pathname || '/'
    return path.replace(/\/\/+/g, '/')
  } catch {
    return url.replace(/\/\/+/g, '/')
  }
}

function formatPageHost(url: string): string {
  try {
    const pageUrl = new URL(url)
    return pageUrl.host + (pageUrl.pathname || '/')
  } catch {
    return url
  }
}

// =============================================================================
// Grouped Check Types
// =============================================================================

/** A check type that may represent multiple page-level instances grouped together. */
interface GroupedCheck {
  /** Representative check (first instance, used for metadata). */
  representative: AuditCheck
  /** All individual check instances (1 for site-wide, N for page-specific). */
  instances: AuditCheck[]
  /** Worst status across all instances. */
  worstStatus: CheckStatus
  /** Number of affected pages (0 for site-wide checks). */
  affectedPageCount: number
}

function worstOf(a: CheckStatus, b: CheckStatus): CheckStatus {
  const order = { [CheckStatus.Failed]: 0, [CheckStatus.Warning]: 1, [CheckStatus.Passed]: 2 }
  return (order[a] ?? 3) <= (order[b] ?? 3) ? a : b
}

/** Group page-specific checks by check_name into GroupedChecks. */
function groupChecksByName(checks: AuditCheck[]): GroupedCheck[] {
  // Separate site-wide from page-specific
  const siteWide: AuditCheck[] = []
  const pageSpecificMap = new Map<string, AuditCheck[]>()

  for (const check of checks) {
    if (check.page_url === null) {
      siteWide.push(check)
    } else {
      if (!pageSpecificMap.has(check.check_name)) {
        pageSpecificMap.set(check.check_name, [])
      }
      pageSpecificMap.get(check.check_name)!.push(check)
    }
  }

  const grouped: GroupedCheck[] = []

  // Site-wide checks: deduplicate by check_name
  const seenSiteWide = new Set<string>()
  for (const check of siteWide) {
    if (seenSiteWide.has(check.check_name)) continue
    seenSiteWide.add(check.check_name)
    grouped.push({
      representative: check,
      instances: [check],
      worstStatus: check.status,
      affectedPageCount: 0,
    })
  }

  // Page-specific checks: group by check_name
  for (const [, instances] of pageSpecificMap) {
    let worst: CheckStatus = CheckStatus.Passed
    for (const inst of instances) {
      worst = worstOf(worst, inst.status)
    }

    // Use the first non-passed instance as representative (for display name), fallback to first
    const representative =
      instances.find((i) => i.status === CheckStatus.Failed) ||
      instances.find((i) => i.status === CheckStatus.Warning) ||
      instances[0]

    grouped.push({
      representative,
      instances,
      worstStatus: worst,
      affectedPageCount: instances.length,
    })
  }

  return grouped
}

function sortGroupedChecks(checks: GroupedCheck[]): GroupedCheck[] {
  const statusOrder: Record<string, number> = { failed: 0, warning: 1, passed: 2 }
  const priorityOrder: Record<string, number> = { critical: 0, recommended: 1, optional: 2 }

  return [...checks].sort((a, b) => {
    const statusDiff = (statusOrder[a.worstStatus] ?? 3) - (statusOrder[b.worstStatus] ?? 3)
    if (statusDiff !== 0) return statusDiff
    const priorityDiff =
      (priorityOrder[a.representative.priority] ?? 3) -
      (priorityOrder[b.representative.priority] ?? 3)
    if (priorityDiff !== 0) return priorityDiff
    // More affected pages = higher priority within same status/priority
    return b.affectedPageCount - a.affectedPageCount
  })
}

// =============================================================================
// Grouped Check Item Component
// =============================================================================

const MAX_VISIBLE_PAGES = 5

interface GroupedCheckItemProps {
  group: GroupedCheck
  totalPages?: number
  onDismiss?: (checkName: string, url: string) => Promise<void>
  onRerun?: (
    checkName: string,
    pageUrls: string[]
  ) => Promise<{ passed: number; failed: number; warnings: number }>
}

function GroupedCheckItem({ group, totalPages, onDismiss, onRerun }: GroupedCheckItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunProgress, setRerunProgress] = useState('')
  const [showAllPages, setShowAllPages] = useState(false)

  const { representative: check, instances, worstStatus, affectedPageCount } = group

  const detailMessage = getDetailMessage(check.details)
  const extractedUrls = extractAffectedUrls(check.details)
  const hasExpandableContent =
    detailMessage ||
    check.description ||
    check.fix_guidance ||
    check.learn_more_url ||
    affectedPageCount > 0 ||
    extractedUrls.length > 0

  const handleDismiss = async () => {
    if (!onDismiss) return
    setIsDismissing(true)
    await onDismiss(check.check_name, check.page_url ?? '')
    setIsDismissing(false)
  }

  const handleRerun = async () => {
    if (!onRerun || affectedPageCount === 0) return
    setIsRerunning(true)
    const urls = instances
      .filter((i) => i.page_url && i.status !== CheckStatus.Passed)
      .map((i) => i.page_url!)
    setRerunProgress(`Re-checking ${urls.length} page${urls.length !== 1 ? 's' : ''}...`)
    try {
      await onRerun(check.check_name, urls)
    } finally {
      setIsRerunning(false)
      setRerunProgress('')
    }
  }

  // For page-specific grouped checks, collect affected pages with their detail snippets
  // For site-wide checks, extract URLs from details (e.g. duplicates)
  const pageEntries = useMemo(() => {
    if (affectedPageCount > 0) {
      const seen = new Set<string>()
      return instances
        .filter((i) => i.page_url && i.status !== CheckStatus.Passed)
        .filter((i) => {
          const path = formatPagePath(i.page_url!)
          if (seen.has(path)) return false
          seen.add(path)
          return true
        })
        .map((inst) => ({
          url: inst.page_url!,
          path: formatPagePath(inst.page_url!),
          status: inst.status,
          snippet: getDetailMessage(inst.details),
        }))
        .sort((a, b) => {
          if (a.path === '/') return -1
          if (b.path === '/') return 1
          return a.path.localeCompare(b.path)
        })
    }

    // Site-wide checks: extract URLs from details
    const urls = extractAffectedUrls(check.details)
    const seen = new Set<string>()
    return urls
      .filter((url) => {
        const path = formatPagePath(url)
        if (seen.has(path)) return false
        seen.add(path)
        return true
      })
      .map((url) => ({
        url,
        path: formatPagePath(url),
        status: check.status,
        snippet: null as string | null,
      }))
      .sort((a, b) => {
        if (a.path === '/') return -1
        if (b.path === '/') return 1
        return a.path.localeCompare(b.path)
      })
  }, [instances, affectedPageCount, check.details, check.status])

  const visiblePages = showAllPages ? pageEntries : pageEntries.slice(0, MAX_VISIBLE_PAGES)
  const hiddenCount = pageEntries.length - MAX_VISIBLE_PAGES

  return (
    <div className="border-b last:border-0">
      <button
        className={cn(
          'flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-gray-50/80',
          hasExpandableContent && 'cursor-pointer',
          expanded && 'border-border/50 border-b'
        )}
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        disabled={!hasExpandableContent}
      >
        <span className={cn('text-lg leading-none', getStatusColor(worstStatus))}>
          {getStatusIcon(worstStatus)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">{getDisplayName(check)}</span>
            {pageEntries.length > 1 && (
              <span className="text-muted-foreground text-xs">
                ({totalPages && pageEntries.length >= totalPages ? 'All ' : ''}
                {pageEntries.length} page{pageEntries.length !== 1 ? 's' : ''})
              </span>
            )}
            {pageEntries.length <= 1 &&
              affectedPageCount > 1 &&
              worstStatus === CheckStatus.Passed && (
                <span className="text-muted-foreground text-xs">
                  ({totalPages && affectedPageCount >= totalPages ? 'All ' : ''}
                  {affectedPageCount} page{affectedPageCount !== 1 ? 's' : ''})
                </span>
              )}
            {pageEntries.length === 1 && pageEntries[0] && (
              <span className="text-muted-foreground text-xs">{pageEntries[0].path}</span>
            )}
          </div>
          {check.description && (
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
              {check.description}
              {check.learn_more_url && (
                <>
                  {' '}
                  <a
                    href={check.learn_more_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="inline size-3" />
                  </a>
                </>
              )}
            </p>
          )}
          {!check.description && check.learn_more_url && (
            <a
              href={check.learn_more_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {hasExpandableContent && (
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {expanded && hasExpandableContent && (
        <div className="bg-muted/30">
          {/* Main content area — flex with invisible icon spacer to align with title text */}
          <div className="flex gap-3 px-6 py-3">
            {/* Spacer matching the icon width */}
            <span className="shrink-0 text-lg leading-none opacity-0" aria-hidden="true">
              {getStatusIcon(worstStatus)}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              {/* Detail message above page list for site-wide checks with extracted URLs */}
              {pageEntries.length > 1 && affectedPageCount === 0 && detailMessage && (
                <p className="text-muted-foreground text-sm">{detailMessage}</p>
              )}
              {/* Affected pages list (grouped page checks or site-wide with extracted URLs) */}
              {pageEntries.length > 1 && (
                <div className="space-y-1">
                  {visiblePages.map((page) => (
                    <div key={page.url} className="flex items-start gap-2 text-xs">
                      <span className="text-muted-foreground mt-0.5 shrink-0">–</span>
                      <div className="min-w-0 flex-1">
                        {page.snippet ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground font-medium hover:underline"
                                style={{ cursor: 'pointer' }}
                              >
                                {page.path}
                              </a>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              {page.snippet}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground font-medium hover:underline"
                          >
                            {page.path}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {!showAllPages && hiddenCount > 0 && (
                    <button
                      className="text-muted-foreground hover:text-foreground text-xs underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAllPages(true)
                      }}
                    >
                      + {hiddenCount} more page{hiddenCount !== 1 ? 's' : ''}
                    </button>
                  )}
                  {showAllPages && hiddenCount > 0 && (
                    <button
                      className="text-muted-foreground hover:text-foreground text-xs underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAllPages(false)
                      }}
                    >
                      Show less
                    </button>
                  )}
                </div>
              )}

              {/* Detail message — show when no page list, or above page list for site-wide checks */}
              {pageEntries.length <= 1 && detailMessage && (
                <p className="text-muted-foreground text-sm">{detailMessage}</p>
              )}
            </div>
          </div>

          {/* Footer with fix guidance + dismiss + re-run */}
          {((check.fix_guidance && check.fix_guidance !== detailMessage) ||
            (onDismiss && worstStatus !== CheckStatus.Passed) ||
            (onRerun && affectedPageCount > 0 && worstStatus !== CheckStatus.Passed)) && (
            <div className="border-border/50 flex gap-3 border-t px-6 py-4">
              <span className="shrink-0 text-lg leading-none opacity-0" aria-hidden="true">
                {getStatusIcon(worstStatus)}
              </span>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {check.fix_guidance && check.fix_guidance !== detailMessage && (
                    <div className="flex items-start gap-2">
                      <Info className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                      <p className="text-muted-foreground text-xs">{check.fix_guidance}</p>
                    </div>
                  )}
                  {onDismiss && worstStatus !== CheckStatus.Passed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-6 shrink-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDismiss()
                      }}
                      disabled={isDismissing || isRerunning}
                    >
                      {isDismissing ? (
                        <Loader2 className="mr-1 size-3 animate-spin" />
                      ) : (
                        <Flag className="mr-1 size-3" />
                      )}
                      Dismiss
                    </Button>
                  )}
                </div>
                {onRerun && affectedPageCount > 0 && worstStatus !== CheckStatus.Passed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 shrink-0 bg-white text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRerun()
                        }}
                        disabled={isRerunning || isDismissing}
                      >
                        {isRerunning ? (
                          <>
                            <Loader2 className="mr-1 size-3 animate-spin" />
                            {rerunProgress}
                          </>
                        ) : (
                          <>
                            <RotateCw className="mr-1 size-3" />
                            Re-run
                          </>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Re-fetch {pageEntries.length} failing page
                      {pageEntries.length !== 1 ? 's' : ''} and re-run this check to verify fixes
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Check List Component
// =============================================================================

interface UnifiedCheckListProps {
  checks: AuditCheck[]
  groupBy?: 'category' | 'page'
  totalPages?: number
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
  onRerunCheck?: (
    checkName: string,
    pageUrls: string[]
  ) => Promise<{ passed: number; failed: number; warnings: number }>
}

export function UnifiedCheckList({
  checks,
  groupBy = 'category',
  totalPages,
  onDismissCheck,
  onRerunCheck,
}: UnifiedCheckListProps) {
  if (checks.length === 0) {
    return <EmptyState icon={CheckCircle} title="No checks to display" />
  }

  if (groupBy === 'page') {
    return <PageGroupedCheckList checks={checks} onDismissCheck={onDismissCheck} />
  }

  return (
    <CategoryGroupedCheckList
      checks={checks}
      totalPages={totalPages}
      onDismissCheck={onDismissCheck}
      onRerunCheck={onRerunCheck}
    />
  )
}

// =============================================================================
// Category-Grouped Check List
// =============================================================================

function CategoryGroupedCheckList({
  checks,
  totalPages,
  onDismissCheck,
  onRerunCheck,
}: {
  checks: AuditCheck[]
  totalPages?: number
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
  onRerunCheck?: (
    checkName: string,
    pageUrls: string[]
  ) => Promise<{ passed: number; failed: number; warnings: number }>
}) {
  // Group by category, then within each category group by check_name
  const groups = useMemo(() => {
    const categoryMap = new Map<string, AuditCheck[]>()
    for (const check of checks) {
      const category = check.category
      if (!categoryMap.has(category)) categoryMap.set(category, [])
      categoryMap.get(category)!.push(check)
    }

    // Build grouped structure per category
    const result: [string, GroupedCheck[]][] = []

    for (const [category, categoryChecks] of categoryMap) {
      const grouped = groupChecksByName(categoryChecks)
      result.push([category, grouped])
    }

    // Sort categories by number of failed grouped checks (most first)
    return result.sort((a, b) => {
      const aFailed = a[1].filter((g) => g.worstStatus === CheckStatus.Failed).length
      const bFailed = b[1].filter((g) => g.worstStatus === CheckStatus.Failed).length
      return bFailed - aFailed
    })
  }, [checks])

  return (
    <div className="space-y-6">
      {groups.map(([category, groupedChecks]) => {
        const sorted = sortGroupedChecks(groupedChecks)
        const failed = sorted.filter((g) => g.worstStatus === CheckStatus.Failed).length
        const warnings = sorted.filter((g) => g.worstStatus === CheckStatus.Warning).length
        const passed = sorted.filter((g) => g.worstStatus === CheckStatus.Passed).length

        return (
          <Collapsible key={category} defaultOpen>
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <CollapsibleTrigger className="flex w-full items-center justify-between bg-gray-50 px-6 py-3 hover:bg-gray-100/50">
                <div className="flex items-center gap-3">
                  <span className="text-base font-semibold">
                    {categoryLabels[category] || category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {failed > 0 && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 tabular-nums">
                      {failed} failed
                    </span>
                  )}
                  {warnings > 0 && (
                    <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 tabular-nums">
                      {warnings} warning{warnings !== 1 ? 's' : ''}
                    </span>
                  )}
                  {passed > 0 && (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 tabular-nums">
                      {passed} passed
                    </span>
                  )}
                  <ChevronDown className="text-muted-foreground ml-1 size-4" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t">
                  {sorted.map((group) => (
                    <GroupedCheckItem
                      key={group.representative.check_name}
                      group={group}
                      totalPages={totalPages}
                      onDismiss={onDismissCheck}
                      onRerun={onRerunCheck}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}

// =============================================================================
// Page-Grouped Check List
// =============================================================================

function sortChecks(checks: AuditCheck[]): AuditCheck[] {
  const statusOrder: Record<string, number> = { failed: 0, warning: 1, passed: 2 }
  const priorityOrder: Record<string, number> = { critical: 0, recommended: 1, optional: 2 }

  return [...checks].sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  })
}

function PageGroupedCheckList({
  checks,
  onDismissCheck,
}: {
  checks: AuditCheck[]
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
}) {
  // Separate site-wide from page-specific
  const siteWide = useMemo(() => {
    const seen = new Set<string>()
    return checks
      .filter((c) => c.page_url === null)
      .filter((c) => {
        if (seen.has(c.check_name)) return false
        seen.add(c.check_name)
        return true
      })
  }, [checks])

  const pageGroups = useMemo(() => {
    const map = new Map<string, AuditCheck[]>()
    for (const check of checks) {
      if (check.page_url === null) continue
      if (!map.has(check.page_url)) map.set(check.page_url, [])
      map.get(check.page_url)!.push(check)
    }
    return Array.from(map.entries()).sort((a, b) => {
      const aFailed = a[1].filter((c) => c.status === CheckStatus.Failed).length
      const bFailed = b[1].filter((c) => c.status === CheckStatus.Failed).length
      return bFailed - aFailed
    })
  }, [checks])

  // Use a simple item component for page-grouped view (no grouping by check name)
  return (
    <div className="space-y-6">
      {siteWide.length > 0 && (
        <Collapsible defaultOpen>
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-4 hover:bg-gray-50/50">
              <div className="flex items-center gap-3">
                <Globe className="text-muted-foreground size-4" />
                <span className="text-base font-semibold">Site-Wide Checks</span>
                <span className="text-muted-foreground text-sm">({siteWide.length})</span>
              </div>
              <ChevronDown className="text-muted-foreground size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t">
                {sortChecks(siteWide).map((check) => (
                  <GroupedCheckItem
                    key={check.id}
                    group={{
                      representative: check,
                      instances: [check],
                      worstStatus: check.status,
                      affectedPageCount: 0,
                    }}
                    onDismiss={onDismissCheck}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {pageGroups.map(([pageUrl, pageChecks]) => {
        const failed = pageChecks.filter((c) => c.status === CheckStatus.Failed).length
        const warnings = pageChecks.filter((c) => c.status === CheckStatus.Warning).length

        return (
          <Collapsible key={pageUrl} defaultOpen={failed > 0}>
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <CollapsibleTrigger className="flex w-full items-center justify-between bg-gray-50 px-6 py-3 hover:bg-gray-100/50">
                <div className="flex items-center gap-3">
                  <span className="max-w-[400px] truncate text-base font-semibold">
                    {formatPageHost(pageUrl)}
                  </span>
                  <span className="text-muted-foreground text-sm">({pageChecks.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  {failed > 0 && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 tabular-nums">
                      {failed} failed
                    </span>
                  )}
                  {warnings > 0 && (
                    <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700 tabular-nums">
                      {warnings} warning{warnings !== 1 ? 's' : ''}
                    </span>
                  )}
                  <ChevronDown className="text-muted-foreground ml-1 size-4" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t">
                  {sortChecks(pageChecks).map((check) => (
                    <GroupedCheckItem
                      key={check.id}
                      group={{
                        representative: check,
                        instances: [check],
                        worstStatus: check.status,
                        affectedPageCount: 0,
                      }}
                      onDismiss={onDismissCheck}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}
