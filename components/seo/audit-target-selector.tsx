'use client'

import { useState } from 'react'
import { ChevronDown, Plus, Building2, Check, Link2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { CreateOrganizationDialog } from '@/components/dashboard/create-organization-dialog'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export type AuditTarget =
  | { type: 'organization'; organizationId: string; url: string }
  | { type: 'one-time'; url: string }
  | { type: 'one-time-history' }
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [oneTimeUrl, setOneTimeUrl] = useState('')

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

    if (selectedTarget.type === 'one-time-history') {
      return (
        <span className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="truncate">One-time Audits</span>
          <Badge variant="secondary" className="text-xs">
            History
          </Badge>
        </span>
      )
    }

    if (selectedTarget.type === 'one-time') {
      return (
        <span className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="truncate">{getDomain(selectedTarget.url)}</span>
          <Badge variant="secondary" className="text-xs">
            One-time
          </Badge>
        </span>
      )
    }

    const org = organizations.find((o) => o.id === selectedTarget.organizationId)
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
    setShowUrlInput(false)
  }

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    if (organization.website_url) {
      onTargetChange({
        type: 'organization',
        organizationId: organization.id,
        url: organization.website_url,
      })
    }
  }

  const handleUseOneTimeUrl = () => {
    if (!oneTimeUrl.trim()) return

    let url = oneTimeUrl.trim()
    // Add https:// if no protocol specified
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    onTargetChange({
      type: 'one-time',
      url,
    })
    setShowUrlInput(false)
    setOneTimeUrl('')
  }

  const handleCancelUrlInput = () => {
    setShowUrlInput(false)
    setOneTimeUrl('')
  }

  // For external users, show simple display of their org
  if (!isInternal) {
    const org = organizations[0]
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

  // Inline URL input mode
  if (showUrlInput) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="url"
          placeholder="https://example.com"
          value={oneTimeUrl}
          onChange={(e) => setOneTimeUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleUseOneTimeUrl()
            } else if (e.key === 'Escape') {
              handleCancelUrlInput()
            }
          }}
          className="w-[280px]"
          autoComplete="off"
          autoFocus
          aria-label="One-time URL to audit"
        />
        <Button size="sm" onClick={handleUseOneTimeUrl} disabled={!oneTimeUrl.trim()}>
          Use URL
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancelUrlInput} title="Cancel">
          <X className="h-4 w-4" />
          <span className="sr-only">Cancel</span>
        </Button>
      </div>
    )
  }

  // Internal users get dropdown
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto min-h-11 gap-2 px-3 py-2 hover:bg-neutral-100">
            {getDisplayLabel()}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          <DropdownMenuItem onClick={() => setShowUrlInput(true)}>
            <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Enter one-time URL…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onTargetChange({ type: 'one-time-history' })}>
            <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
            One-time Audit History
            {selectedTarget?.type === 'one-time-history' && (
              <Check className="ml-auto h-4 w-4 text-green-600" aria-hidden="true" />
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Create new organization…
          </DropdownMenuItem>
          {organizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
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

      <CreateOrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleOrganizationCreated}
      />
    </>
  )
}
