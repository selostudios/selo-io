'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'

interface Props {
  orgId: string
  memo: string
  updatedAt: string | null
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatDistanceToNow(date, { addSuffix: true })
}

export function StyleMemoPreview({ orgId, memo, updatedAt }: Props) {
  const [expanded, setExpanded] = useState(false)

  const trimmed = memo.trim()
  const isEmpty = trimmed.length === 0
  const wordCount = countWords(memo)
  const relative = formatRelative(updatedAt)

  const collapsedLabel = isEmpty
    ? 'Style memo empty — publish your first report to start the AI learning.'
    : `Style the AI is using — ${wordCount} ${wordCount === 1 ? 'word' : 'words'}${
        relative ? `, updated ${relative}` : ''
      }`

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/60 p-5 shadow-sm dark:border-indigo-500/30 dark:from-indigo-950/30 dark:via-slate-950 dark:to-purple-950/30"
      data-testid="style-memo-preview"
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-600"
      />
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => {
            if (isEmpty) return
            setExpanded((prev) => !prev)
          }}
          disabled={isEmpty}
          aria-expanded={expanded}
          data-testid="style-memo-preview-toggle"
          className="group flex w-full items-center gap-2 text-left text-sm font-semibold text-indigo-950 disabled:cursor-default dark:text-indigo-100"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="flex-1">{collapsedLabel}</span>
          {!isEmpty &&
            (expanded ? (
              <ChevronDown
                className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
                aria-hidden
              />
            ))}
        </button>

        {expanded && !isEmpty && (
          <div className="space-y-3">
            <div
              data-testid="style-memo-preview-content"
              className="max-h-64 overflow-y-auto rounded-md border border-indigo-200 bg-white/80 p-3 text-sm whitespace-pre-wrap text-indigo-950 dark:border-indigo-500/30 dark:bg-slate-950/60 dark:text-indigo-100"
            >
              {trimmed}
            </div>
            <div className="text-xs">
              <Link
                href={`/${orgId}/reports/performance/settings`}
                className="text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300"
              >
                Edit in settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
