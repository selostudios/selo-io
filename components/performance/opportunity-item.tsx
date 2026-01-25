'use client'

import type { Opportunity } from '@/lib/performance/types'
import { AlertTriangle, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ExpandableUrlList } from '@/components/ui/expandable-url-list'

interface OpportunityItemProps {
  opportunity: Opportunity
}

function formatSeconds(ms: number): string {
  const seconds = ms / 1000
  return `${seconds.toFixed(1)}s`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatResourceInfo(item: {
  url?: string
  totalBytes?: number
  wastedBytes?: number
  wastedMs?: number
}): string {
  const parts: string[] = []

  if (item.totalBytes) {
    parts.push(formatBytes(item.totalBytes))
  } else if (item.wastedBytes) {
    parts.push(formatBytes(item.wastedBytes))
  }

  if (item.wastedMs) {
    parts.push(`${item.wastedMs.toFixed(0)}ms`)
  }

  if (parts.length > 0) {
    return ` (${parts.join(', ')})`
  }
  return ''
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

export function OpportunityItem({ opportunity }: OpportunityItemProps) {
  // Use displayValue from PageSpeed API if available (already formatted), otherwise format numericValue
  const savingsDisplay = opportunity.displayValue || formatSeconds(opportunity.numericValue)
  const { text: descriptionText, learnMoreUrl } = parseDescription(opportunity.description)

  // Extract URLs from details.items
  const items = opportunity.details?.items ?? []
  const urls = items
    .filter((item) => item.url)
    .map((item) => {
      const resourceInfo = formatResourceInfo(item)
      return `${item.url}${resourceInfo}`
    })

  const urlGroups = urls.length > 0 ? [{ urls }] : []

  return (
    <div className="group/opportunity py-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-yellow-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{opportunity.title}</span>
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
              label={`View ${urls.length} affected resource${urls.length !== 1 ? 's' : ''}`}
            />
          )}
        </div>
        <span className="shrink-0 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 tabular-nums dark:bg-yellow-900/30 dark:text-yellow-400">
          {savingsDisplay}
        </span>
      </div>
    </div>
  )
}
