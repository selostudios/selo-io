'use client'

import { ChevronDown, Building2, Check, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export type AuditTarget =
  | { type: 'organization'; organizationId: string; url: string }
  | { type: 'one-time' }
  | null

interface AuditTargetSelectorProps {
  organizations: OrganizationForSelector[]
  selectedTarget: AuditTarget
  onTargetChange: (target: AuditTarget) => void
  isInternal: boolean
}

const statusColors: Record<string, string> = {
  prospect: 'bg-amber-100 text-amber-700',
  customer: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
}

export function AuditTargetSelector({
  organizations,
  selectedTarget,
  onTargetChange,
  isInternal,
}: AuditTargetSelectorProps) {
  // Filter out inactive organizations
  const activeOrganizations = organizations.filter((org) => org.status !== 'inactive')

  const getDomain = (url: string | null): string => {
    if (!url) return ''
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const getDisplayLabel = (): React.ReactNode => {
    if (!selectedTarget) {
      return <span className="text-neutral-500">Select audit target</span>
    }

    if (selectedTarget.type === 'one-time') {
      return (
        <span className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="truncate">One-time Audits</span>
        </span>
      )
    }

    const org = activeOrganizations.find((o) => o.id === selectedTarget.organizationId)
    if (!org) {
      return <span className="text-neutral-500">Select audit target</span>
    }

    return (
      <>
        <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        <span className="truncate font-medium">{org.name}</span>
        <Badge variant="secondary" className={cn('text-xs', statusColors[org.status])}>
          {org.status}
        </Badge>
      </>
    )
  }

  const handleSelectOrganization = (org: OrganizationForSelector) => {
    if (!org.website_url) return
    onTargetChange({
      type: 'organization',
      organizationId: org.id,
      url: org.website_url,
    })
  }

  const handleSelectOneTime = () => {
    onTargetChange({
      type: 'one-time',
    })
  }

  // For external users, show simple display of their org
  if (!isInternal) {
    const org = activeOrganizations[0]
    if (!org) {
      return (
        <div className="flex items-center gap-2 px-3 py-2">
          <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="text-neutral-500">No organization</span>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        <span className="font-medium">{org.name}</span>
        {org.website_url && (
          <span className="text-muted-foreground text-sm">({getDomain(org.website_url)})</span>
        )}
      </div>
    )
  }

  // Internal users get dropdown
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto min-h-11 gap-2 bg-white px-3 py-2 hover:bg-neutral-100">
            {getDisplayLabel()}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          <DropdownMenuItem onClick={handleSelectOneTime}>
            <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Enter one-time URL…
            {selectedTarget?.type === 'one-time' && (
              <Check className="ml-auto h-4 w-4 text-green-600" aria-hidden="true" />
            )}
          </DropdownMenuItem>
          {activeOrganizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {activeOrganizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelectOrganization(org)}
                  className="flex items-center justify-between py-2"
                  disabled={!org.website_url}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{org.name}</span>
                      <Badge
                        variant="secondary"
                        className={cn('text-xs', statusColors[org.status])}
                      >
                        {org.status}
                      </Badge>
                    </div>
                    {org.website_url ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {getDomain(org.website_url)}
                      </span>
                    ) : (
                      <span className="truncate text-xs text-neutral-400">No website URL</span>
                    )}
                  </div>
                  {selectedTarget?.type === 'organization' &&
                    selectedTarget.organizationId === org.id && (
                      <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                    )}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
