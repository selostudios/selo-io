'use client'

import { useState, useMemo } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { ChevronDown, CheckCircle, Globe, ExternalLink, Info, Flag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CheckStatus, CheckCategory } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'
import { ExpandableUrlList, type UrlGroup } from '@/components/ui/expandable-url-list'

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

function sortChecks(checks: AuditCheck[]): AuditCheck[] {
  const statusOrder: Record<string, number> = { failed: 0, warning: 1, passed: 2 }
  const priorityOrder: Record<string, number> = { critical: 0, recommended: 1, optional: 2 }

  return [...checks].sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)
  })
}

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

function formatPagePath(url: string): string {
  try {
    const pageUrl = new URL(url)
    return pageUrl.host + (pageUrl.pathname || '/')
  } catch {
    return url
  }
}

// =============================================================================
// Check Item Component
// =============================================================================

interface UnifiedCheckItemProps {
  check: AuditCheck
  onDismiss?: (checkName: string, url: string) => Promise<void>
}

function UnifiedCheckItem({ check, onDismiss }: UnifiedCheckItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)

  const detailMessage = getDetailMessage(check.details)
  const hasExpandableContent =
    detailMessage || check.description || check.fix_guidance || check.learn_more_url

  // Build URL groups for page-specific issues
  const urlGroups: UrlGroup[] = []
  if (check.details?.affected_pages && Array.isArray(check.details.affected_pages)) {
    urlGroups.push({
      label: 'Affected Pages',
      urls: check.details.affected_pages as string[],
    })
  }

  const handleDismiss = async () => {
    if (!onDismiss) return
    setIsDismissing(true)
    await onDismiss(check.check_name, check.page_url ?? '')
    setIsDismissing(false)
  }

  return (
    <div className="border-b last:border-0">
      <button
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
          hasExpandableContent && 'cursor-pointer'
        )}
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        disabled={!hasExpandableContent}
      >
        <span className={cn('text-lg', getStatusColor(check.status))}>
          {getStatusIcon(check.status)}
        </span>
        <div className="flex-1">
          <span className="text-sm font-medium">{getDisplayName(check)}</span>
          {check.page_url && (
            <span className="text-muted-foreground ml-2 text-xs">
              {formatPagePath(check.page_url)}
            </span>
          )}
        </div>
        <span className="text-muted-foreground text-xs capitalize">{check.priority}</span>
        {hasExpandableContent && (
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {expanded && hasExpandableContent && (
        <div className="space-y-2 border-t bg-gray-50/50 px-4 py-3 pl-11">
          {detailMessage && <p className="text-sm">{detailMessage}</p>}
          {check.description && !detailMessage && (
            <p className="text-muted-foreground text-sm">{check.description}</p>
          )}
          {check.fix_guidance && (
            <div className="flex items-start gap-2">
              <Info className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p className="text-muted-foreground text-sm">{check.fix_guidance}</p>
            </div>
          )}
          {urlGroups.length > 0 && (
            <div className="mt-2">
              <ExpandableUrlList groups={urlGroups} />
            </div>
          )}
          {check.learn_more_url && (
            <a
              href={check.learn_more_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              Learn more
              <ExternalLink className="size-3" />
            </a>
          )}
          {onDismiss && check.status !== CheckStatus.Passed && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground mt-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss()
              }}
              disabled={isDismissing}
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
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
}

export function UnifiedCheckList({
  checks,
  groupBy = 'category',
  onDismissCheck,
}: UnifiedCheckListProps) {
  if (checks.length === 0) {
    return <EmptyState icon={CheckCircle} title="No checks to display" />
  }

  if (groupBy === 'page') {
    return <PageGroupedCheckList checks={checks} onDismissCheck={onDismissCheck} />
  }

  return <CategoryGroupedCheckList checks={checks} onDismissCheck={onDismissCheck} />
}

// =============================================================================
// Category-Grouped Check List
// =============================================================================

function CategoryGroupedCheckList({
  checks,
  onDismissCheck,
}: {
  checks: AuditCheck[]
  onDismissCheck?: (checkName: string, url: string) => Promise<void>
}) {
  // Deduplicate site-wide checks (same check_name)
  const deduped = useMemo(() => {
    const seen = new Set<string>()
    return checks.filter((c) => {
      if (c.page_url === null) {
        if (seen.has(c.check_name)) return false
        seen.add(c.check_name)
      }
      return true
    })
  }, [checks])

  // Group by category
  const groups = useMemo(() => {
    const map = new Map<string, AuditCheck[]>()
    for (const check of deduped) {
      const category = check.category
      if (!map.has(category)) map.set(category, [])
      map.get(category)!.push(check)
    }
    // Sort groups by number of failed checks (most first)
    return Array.from(map.entries()).sort((a, b) => {
      const aFailed = a[1].filter((c) => c.status === CheckStatus.Failed).length
      const bFailed = b[1].filter((c) => c.status === CheckStatus.Failed).length
      return bFailed - aFailed
    })
  }, [deduped])

  return (
    <div className="space-y-4">
      {groups.map(([category, categoryChecks]) => {
        const sorted = sortChecks(categoryChecks)
        const failed = sorted.filter((c) => c.status === CheckStatus.Failed).length
        const passed = sorted.filter((c) => c.status === CheckStatus.Passed).length

        return (
          <Collapsible key={category} defaultOpen={failed > 0}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <Globe className="text-muted-foreground size-4" />
                <span className="font-medium">{categoryLabels[category] || category}</span>
                <span className="text-muted-foreground text-sm">({categoryChecks.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {failed > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 tabular-nums">
                    {failed} failed
                  </span>
                )}
                {passed > 0 && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 tabular-nums">
                    {passed} passed
                  </span>
                )}
                <ChevronDown className="text-muted-foreground size-4" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 rounded-lg border">
                {sorted.map((check) => (
                  <UnifiedCheckItem key={check.id} check={check} onDismiss={onDismissCheck} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}

// =============================================================================
// Page-Grouped Check List
// =============================================================================

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

  return (
    <div className="space-y-4">
      {siteWide.length > 0 && (
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <Globe className="text-muted-foreground size-4" />
              <span className="font-medium">Site-Wide Checks</span>
              <span className="text-muted-foreground text-sm">({siteWide.length})</span>
            </div>
            <ChevronDown className="text-muted-foreground size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 rounded-lg border">
              {sortChecks(siteWide).map((check) => (
                <UnifiedCheckItem key={check.id} check={check} onDismiss={onDismissCheck} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {pageGroups.map(([pageUrl, pageChecks]) => {
        const failed = pageChecks.filter((c) => c.status === CheckStatus.Failed).length

        return (
          <Collapsible key={pageUrl} defaultOpen={failed > 0}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="max-w-[400px] truncate text-sm font-medium">
                  {formatPagePath(pageUrl)}
                </span>
                <span className="text-muted-foreground text-sm">({pageChecks.length})</span>
              </div>
              <div className="flex items-center gap-2">
                {failed > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 tabular-nums">
                    {failed} failed
                  </span>
                )}
                <ChevronDown className="text-muted-foreground size-4" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 rounded-lg border">
                {sortChecks(pageChecks).map((check) => (
                  <UnifiedCheckItem key={check.id} check={check} onDismiss={onDismissCheck} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}
