'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { SiteAuditCheck } from '@/lib/audit/types'
import { ChevronRight } from 'lucide-react'

interface CheckItemProps {
  check: SiteAuditCheck
}

function getStatusIcon(check: SiteAuditCheck): string {
  if (check.status === 'passed') return '\u2713' // checkmark
  if (check.status === 'warning') return '\u26A0' // warning triangle
  if (check.priority === 'critical') return '\u26D4' // no entry (critical fail)
  return '\u26A0' // warning for recommended/optional fails
}

function getStatusColor(check: SiteAuditCheck): string {
  if (check.status === 'passed') return 'text-green-600'
  if (check.status === 'warning') return 'text-yellow-600'
  if (check.priority === 'critical') return 'text-red-600'
  return 'text-yellow-600'
}

function formatCheckName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getAffectedPages(details: Record<string, unknown> | null): string[] {
  if (!details) return []

  // Check common patterns for storing affected pages in details
  if (Array.isArray(details.pages)) {
    return details.pages as string[]
  }
  if (Array.isArray(details.affected_pages)) {
    return details.affected_pages as string[]
  }
  if (Array.isArray(details.urls)) {
    return details.urls as string[]
  }

  return []
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

export function CheckItem({ check }: CheckItemProps) {
  const affectedPages = getAffectedPages(check.details)
  const detailMessage = getDetailMessage(check.details)
  const hasExpandableContent = affectedPages.length > 0 || detailMessage

  const statusIcon = getStatusIcon(check)
  const statusColor = getStatusColor(check)

  const content = (
    <div className="flex w-full items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span className={cn('text-lg', statusColor)} aria-hidden="true">
          {statusIcon}
        </span>
        <span className="text-sm">{formatCheckName(check.check_name)}</span>
        {affectedPages.length > 0 && (
          <span className="text-muted-foreground text-sm">
            ({affectedPages.length} page{affectedPages.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>
      {hasExpandableContent && (
        <ChevronRight
          className={cn(
            'text-muted-foreground h-4 w-4 transition-transform',
            'group-data-[state=open]:rotate-90'
          )}
        />
      )}
    </div>
  )

  if (!hasExpandableContent) {
    return <div className="hover:bg-muted/50 rounded-md px-3 transition-colors">{content}</div>
  }

  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="hover:bg-muted/50 w-full rounded-md px-3 text-left transition-colors">
        {content}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pt-1 pb-3">
        <div className="border-muted ml-7 space-y-2 border-l-2 pl-4">
          {detailMessage && <p className="text-muted-foreground text-sm">{detailMessage}</p>}
          {affectedPages.length > 0 && (
            <ul className="space-y-1">
              {affectedPages.slice(0, 10).map((page, index) => (
                <li key={index} className="text-muted-foreground truncate text-sm">
                  {page}
                </li>
              ))}
              {affectedPages.length > 10 && (
                <li className="text-muted-foreground text-sm">
                  ...and {affectedPages.length - 10} more
                </li>
              )}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
