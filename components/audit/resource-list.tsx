'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { SiteAuditPage } from '@/lib/audit/types'
import { ChevronDown, Download, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResourceListProps {
  resources: SiteAuditPage[]
  baseUrl: string
}

function formatResourceType(resourceType: string | null | undefined): string {
  if (!resourceType) return 'File'
  const labels: Record<string, string> = {
    pdf: 'PDF',
    document: 'Document',
    spreadsheet: 'Spreadsheet',
    presentation: 'Presentation',
    archive: 'Archive',
    image: 'Image',
    other: 'File',
  }
  return labels[resourceType] || 'File'
}

function formatPagePath(url: string, baseUrl: string): string {
  try {
    const pageUrl = new URL(url)
    const base = new URL(baseUrl)
    if (pageUrl.origin === base.origin) {
      return pageUrl.pathname || '/'
    }
    return url
  } catch {
    return url
  }
}

export function ResourceList({ resources, baseUrl }: ResourceListProps) {
  if (resources.length === 0) {
    return null
  }

  return (
    <Collapsible defaultOpen className="group/list">
      <CollapsibleTrigger className="bg-background hover:bg-muted/50 flex w-full items-center justify-between rounded-md px-4 py-3 transition-colors">
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/list:-rotate-90'
            )}
          />
          <Download className="text-muted-foreground size-5" />
          <span className="text-lg font-semibold">Resources</span>
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {resources.length} file{resources.length !== 1 ? 's' : ''}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2 pl-4">
        <p className="text-muted-foreground px-3 text-xs">
          Downloadable files found on your site. These are not analyzed for SEO checks.
        </p>
        {resources.map((resource) => (
          <div
            key={resource.id}
            className="bg-muted/30 hover:bg-muted/50 flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
          >
            <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs font-medium">
              {formatResourceType(resource.resource_type)}
            </span>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-0 flex-1 items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
              title={resource.url}
            >
              <span className="truncate">
                {resource.title || formatPagePath(resource.url, baseUrl)}
              </span>
              <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
            </a>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
