'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CheckItem } from './check-item'
import type { SiteAuditCheck } from '@/lib/audit/types'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckListProps {
  title: string
  checks: SiteAuditCheck[]
}

export function CheckList({ title, checks }: CheckListProps) {
  const failedCount = checks.filter((c) => c.status === 'failed').length
  const warningCount = checks.filter((c) => c.status === 'warning').length
  const passedCount = checks.filter((c) => c.status === 'passed').length

  // Sort checks: failed first (critical, then recommended, then optional), then warnings, then passed
  const sortedChecks = [...checks].sort((a, b) => {
    const statusOrder = { failed: 0, warning: 1, passed: 2 }
    const priorityOrder = { critical: 0, recommended: 1, optional: 2 }

    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff

    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  return (
    <Collapsible defaultOpen className="group">
      <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between rounded-md px-4 py-3 transition-colors">
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground h-5 w-5 transition-transform',
              'group-data-[state=closed]:-rotate-90'
            )}
          />
          <span className="text-lg font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {failedCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
              {failedCount} failed
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
              {warningCount} warnings
            </span>
          )}
          {passedCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
              {passedCount} passed
            </span>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 pl-4">
        {sortedChecks.map((check) => (
          <CheckItem key={check.id} check={check} />
        ))}
        {sortedChecks.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No checks in this category
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
