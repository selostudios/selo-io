'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { SiteAuditCheck } from '@/lib/audit/types'
import { Flag, Info, Loader2 } from 'lucide-react'
import { ExpandableUrlList, type UrlGroup } from '@/components/ui/expandable-url-list'

interface CheckItemProps {
  check: SiteAuditCheck
  pageUrl?: string
  onDismiss?: (checkName: string, url: string) => Promise<void>
}

function getStatusIcon(check: SiteAuditCheck): string {
  if (check.status === 'passed') return '✓'
  if (check.status === 'warning') return '⚠'
  return '✗' // failed
}

function getStatusColor(check: SiteAuditCheck): string {
  if (check.status === 'passed') return 'text-green-600'
  if (check.status === 'warning') return 'text-yellow-600'
  return 'text-red-600' // failed
}

function getDisplayName(check: SiteAuditCheck): string {
  // Use appropriate display name based on status
  if (check.status === 'passed' && check.display_name_passed) {
    return check.display_name_passed
  }
  if (check.display_name) {
    return check.display_name
  }
  // Fallback: format check_name
  return check.check_name
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getDetailMessage(details: Record<string, unknown> | null): string | null {
  if (!details) return null

  if (typeof details.message === 'string') {
    return details.message
  }
  if (typeof details.description === 'string') {
    return details.description
  }
  if (typeof details.reason === 'string') {
    return details.reason
  }

  return null
}

function getExpandableUrls(details: Record<string, unknown> | null): UrlGroup[] | null {
  if (!details) return null

  // Handle duplicate_titles check format
  if (Array.isArray(details.duplicates)) {
    const duplicates = details.duplicates as Array<{
      title?: string
      urls?: string[]
      count?: number
    }>
    const groups: UrlGroup[] = []

    for (const dup of duplicates) {
      if (dup.title && Array.isArray(dup.urls) && dup.urls.length > 0) {
        groups.push({
          label: dup.title,
          urls: dup.urls,
          count: dup.count,
        })
      }
    }

    return groups.length > 0 ? groups : null
  }

  // Handle broken_internal_links check format
  if (Array.isArray(details.brokenUrls)) {
    const brokenUrls = details.brokenUrls as Array<{ url?: string; status?: number }>
    const urls = brokenUrls
      .filter((b) => typeof b.url === 'string')
      .map((b) => `${b.url} (${b.status})`)

    if (urls.length > 0) {
      return [{ label: 'Broken URLs', urls }]
    }
  }

  return null
}

function LinkifiedMessage({ message }: { message: string }) {
  // Match URLs in the message
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = message.split(urlRegex)

  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          // Reset regex lastIndex since we're reusing it
          urlRegex.lastIndex = 0
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function CheckItem({ check, pageUrl, onDismiss }: CheckItemProps) {
  const [isDismissing, setIsDismissing] = useState(false)
  const statusIcon = getStatusIcon(check)
  const statusColor = getStatusColor(check)
  const displayName = getDisplayName(check)
  const detailMessage = getDetailMessage(check.details)
  const expandableUrls = getExpandableUrls(check.details)

  const canDismiss = onDismiss && pageUrl && check.status !== 'passed'

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDismiss || !pageUrl) return

    setIsDismissing(true)
    try {
      await onDismiss(check.check_name, pageUrl)
    } finally {
      setIsDismissing(false)
    }
  }

  return (
    <div className="group/check bg-muted/30 hover:bg-muted/50 rounded-md px-3 py-2 transition-colors">
      <div className="flex items-start gap-3">
        <span className={cn('text-base', statusColor)} aria-hidden="true">
          {statusIcon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{displayName}</span>
            {check.learn_more_url && (
              <a
                href={check.learn_more_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                title="Learn more"
              >
                <Info className="size-3.5" />
              </a>
            )}
          </div>
          {detailMessage && (
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              <LinkifiedMessage message={detailMessage} />
            </p>
          )}
          {expandableUrls && expandableUrls.length > 0 && (
            <ExpandableUrlList groups={expandableUrls} />
          )}
        </div>
        {canDismiss && (
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer opacity-0 transition-opacity duration-1000 group-hover/check:opacity-100 disabled:opacity-50"
            title="Dismiss this check (mark as not applicable)"
          >
            {isDismissing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Flag className="size-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
