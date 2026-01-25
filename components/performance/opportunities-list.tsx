'use client'

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { OpportunityItem } from './opportunity-item'
import type { Opportunity } from '@/lib/performance/types'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OpportunitiesListProps {
  opportunities: Opportunity[]
}

export function OpportunitiesList({ opportunities }: OpportunitiesListProps) {
  const count = opportunities.length

  return (
    <Collapsible defaultOpen={true} className="group/list">
      <div className="flex w-full items-center justify-between rounded-md bg-white px-4 py-3 dark:bg-gray-800">
        <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-3">
          <ChevronDown
            className={cn(
              'text-muted-foreground size-5 transition-transform duration-200',
              'group-data-[state=closed]/list:-rotate-90'
            )}
          />
          <span className="text-lg font-semibold text-balance">Opportunities</span>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {count} item{count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <CollapsibleContent className="divide-y divide-gray-200 px-4 dark:divide-gray-700">
        {opportunities.map((opportunity) => (
          <OpportunityItem key={opportunity.id} opportunity={opportunity} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
