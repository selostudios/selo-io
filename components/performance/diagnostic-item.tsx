'use client'

import type { Diagnostic } from '@/lib/performance/types'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ExpandableUrlList } from '@/components/ui/expandable-url-list'

interface DiagnosticItemProps {
  diagnostic: Diagnostic
}

// Extract markdown links and return { text, learnMoreUrl }
function parseDescription(description: string): { text: string; learnMoreUrl: string | null } {
  // Match markdown links like [Learn more](https://...)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  let learnMoreUrl: string | null = null

  // Find the first link in the description
  const matches = [...description.matchAll(linkRegex)]
  if (matches.length > 0) {
    learnMoreUrl = matches[0][2]
  }

  // Remove all markdown links from text and clean up trailing punctuation
  const text = description
    .replace(linkRegex, '')
    .replace(/\s+\./g, '.') // Remove space before period
    .replace(/\.+$/g, '.') // Remove multiple trailing periods
    .replace(/\s+$/g, '') // Trim trailing whitespace
    .trim()

  return { text, learnMoreUrl }
}

function formatMs(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${Math.round(ms)}ms`
}

function formatItemInfo(item: Record<string, unknown>): string {
  const parts: string[] = []

  // Common numeric fields in diagnostic items
  if (typeof item.total === 'number') {
    parts.push(formatMs(item.total))
  }
  if (typeof item.transferSize === 'number') {
    const kb = (item.transferSize as number) / 1024
    parts.push(kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`)
  }
  if (typeof item.wastedMs === 'number') {
    parts.push(`${Math.round(item.wastedMs as number)}ms wasted`)
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : ''
}

export function DiagnosticItem({ diagnostic }: DiagnosticItemProps) {
  const { text: descriptionText, learnMoreUrl } = parseDescription(diagnostic.description)

  // Extract URLs from details.items
  const items = diagnostic.details?.items ?? []
  const urls = items
    .filter((item): item is Record<string, unknown> => {
      if (typeof item !== 'object' || item === null) return false
      const itemObj = item as Record<string, unknown>
      // Check if item has a url property that's a valid URL (not "Unattributable" etc)
      return typeof itemObj.url === 'string' && itemObj.url.startsWith('http')
    })
    .map((item) => {
      const info = formatItemInfo(item)
      return `${item.url}${info}`
    })

  const urlGroups = urls.length > 0 ? [{ urls }] : []

  return (
    <div className="group/diagnostic py-3">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{diagnostic.title}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                {learnMoreUrl ? (
                  <a
                    href={learnMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors"
                  >
                    <Info className="size-3.5" />
                    <span className="sr-only">Learn more</span>
                  </a>
                ) : (
                  <button
                    className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors"
                    aria-label="More information"
                  >
                    <Info className="size-3.5" />
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs text-pretty">{descriptionText}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed text-pretty">
            {descriptionText}
          </p>
          {urlGroups.length > 0 && (
            <ExpandableUrlList
              groups={urlGroups}
              label={`View ${urls.length} resource${urls.length !== 1 ? 's' : ''}`}
            />
          )}
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 tabular-nums dark:bg-slate-800 dark:text-slate-300">
          {diagnostic.displayValue}
        </span>
      </div>
    </div>
  )
}
