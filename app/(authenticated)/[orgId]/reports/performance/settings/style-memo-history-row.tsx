'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MemoHistoryRow } from '@/lib/reviews/narrative/memo-history-types'

interface Props {
  row: MemoHistoryRow
  adminName: string | null
  reviewId: string | null
  quarterLabel: string | null
  orgId: string
  index: number
}

/**
 * Single timeline entry for the learned-style memo history. Shows a source
 * badge (Auto / Manual), relative timestamp, the learner's rationale or a
 * manual-edit summary, and an expandable reveal of the full memo snapshot.
 * Client component because of the expand/collapse state.
 */
export function StyleMemoHistoryRow({
  row,
  adminName,
  reviewId,
  quarterLabel,
  orgId,
  index,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const isAuto = row.source === 'auto'
  const relative = formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })

  return (
    <div
      data-testid={`style-memo-history-row-${index}`}
      className="space-y-2 rounded-lg border p-3"
    >
      <div className="flex items-center gap-2">
        <Badge variant={isAuto ? 'default' : 'secondary'}>{isAuto ? 'Auto' : 'Manual'}</Badge>
        <span className="text-muted-foreground text-xs">{relative}</span>
      </div>

      {isAuto ? (
        row.rationale ? (
          <p className="text-sm">{row.rationale}</p>
        ) : null
      ) : (
        <p className="text-sm">{adminName ? `Manual edit by ${adminName}` : 'Manual edit'}</p>
      )}

      {reviewId && quarterLabel ? (
        <Link
          href={`/${orgId}/reports/performance/${reviewId}`}
          className="text-muted-foreground hover:text-foreground block text-xs underline-offset-2 hover:underline"
        >
          From {quarterLabel} report
        </Link>
      ) : null}

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          data-testid={`style-memo-history-expand-${index}`}
          className="h-7 px-2 text-xs"
        >
          {expanded ? (
            <ChevronDown className="mr-1 h-3 w-3" aria-hidden />
          ) : (
            <ChevronRight className="mr-1 h-3 w-3" aria-hidden />
          )}
          View memo
        </Button>
        {expanded ? (
          <pre className="bg-muted/30 text-muted-foreground mt-2 rounded-md border p-3 text-xs whitespace-pre-wrap">
            {row.memo || '(empty memo)'}
          </pre>
        ) : null}
      </div>
    </div>
  )
}
