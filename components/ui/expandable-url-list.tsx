'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

export interface UrlGroup {
  label?: string
  urls: string[]
  count?: number
}

interface ExpandableUrlListProps {
  groups: UrlGroup[]
  label?: string
}

function extractCleanUrl(url: string): string {
  // Extract URL from formatted strings like "https://... (404)"
  const urlMatch = url.match(/^(https?:\/\/[^\s]+)/)
  return urlMatch ? urlMatch[1] : url
}

export function ExpandableUrlList({ groups, label }: ExpandableUrlListProps) {
  const totalUrls = groups.reduce((sum, g) => sum + g.urls.length, 0)

  if (totalUrls === 0) return null

  return (
    <Collapsible className="group/urls mt-2">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors">
        <ChevronDown
          className={cn('size-3 transition-transform', 'group-data-[state=closed]/urls:-rotate-90')}
        />
        <span>{label || `View ${totalUrls} affected URL${totalUrls !== 1 ? 's' : ''}`}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1">
            {group.label && (
              <div className="text-muted-foreground text-xs font-medium">
                {group.label}
                {group.count && group.count > group.urls.length && (
                  <span className="ml-1 font-normal">
                    (showing {group.urls.length} of {group.count})
                  </span>
                )}
              </div>
            )}
            <ul className="space-y-0.5 pl-3">
              {group.urls.map((url, urlIndex) => {
                const cleanUrl = extractCleanUrl(url)

                return (
                  <li key={urlIndex} className="text-xs">
                    <a
                      href={cleanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {url}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
