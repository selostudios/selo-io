import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export interface StyleMemoPopoverProps {
  orgId: string
  memo: string
  updatedAt: string | null
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true })
}

export function StyleMemoPopover({ orgId, memo, updatedAt }: StyleMemoPopoverProps) {
  const trimmed = memo.trim()
  const isEmpty = trimmed.length === 0
  const relative = formatRelative(updatedAt)

  if (isEmpty) {
    return (
      <div data-testid="style-memo-popover" className="space-y-2">
        <div className="text-foreground text-sm font-semibold">Style memo</div>
        <p className="text-muted-foreground text-sm">
          Style memo empty — publish your first report to start the AI learning.
        </p>
      </div>
    )
  }

  return (
    <div data-testid="style-memo-popover" className="space-y-3">
      <div className="text-foreground text-sm font-semibold">Style memo</div>
      <div className="bg-muted/40 text-foreground max-h-64 overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap">
        {trimmed}
      </div>
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        {relative ? <span>updated {relative}</span> : <span />}
        <Link
          href={`/${orgId}/reports/performance/settings`}
          className="text-primary underline-offset-2 hover:underline"
        >
          Edit in settings
        </Link>
      </div>
    </div>
  )
}
