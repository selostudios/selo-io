'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ChevronDown, Plus, Building2, Check } from 'lucide-react'
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
import { CreateOrganizationDialog } from './create-organization-dialog'
import type { OrganizationForSelector } from '@/lib/organizations/types'

const LAST_ORG_KEY = 'selo-last-organization-id'
const CHILD_SIDEBAR_COLLAPSED_KEY = 'child-sidebar-collapsed'

interface OrganizationSelectorProps {
  organizations: OrganizationForSelector[]
  selectedOrganizationId?: string | null
}

const statusColors: Record<string, string> = {
  prospect: 'bg-amber-100 text-amber-700',
  customer: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
}

export function OrganizationSelector({
  organizations,
  selectedOrganizationId: initialSelectedOrgId,
}: OrganizationSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Read org from URL searchParams, falling back to prop
  const selectedOrganizationId = searchParams.get('org') || initialSelectedOrgId
  const selectedOrg = organizations.find((o) => o.id === selectedOrganizationId)

  const handleSelectOrganization = (orgId: string) => {
    localStorage.setItem(LAST_ORG_KEY, orgId)
    // Expand sidebar when selecting an organization
    localStorage.setItem(CHILD_SIDEBAR_COLLAPSED_KEY, 'false')
    window.dispatchEvent(new Event('sidebar-expand'))
    // Add org param to current URL
    const url = new URL(window.location.href)
    url.searchParams.set('org', orgId)
    router.push(pathname + url.search)
  }

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    handleSelectOrganization(organization.id)
  }

  // Restore last selected org from localStorage on mount
  useEffect(() => {
    if (!selectedOrganizationId && organizations.length > 0) {
      const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
      if (lastOrgId) {
        const orgExists = organizations.some((o) => o.id === lastOrgId)
        if (orgExists) {
          handleSelectOrganization(lastOrgId)
        } else {
          // Fallback to first org
          handleSelectOrganization(organizations[0].id)
        }
      } else {
        // Default to first org
        handleSelectOrganization(organizations[0].id)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getDomain = (url: string | null): string => {
    if (!url) return ''
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto min-h-11 gap-2 px-3 py-2 hover:bg-neutral-100">
            {selectedOrg ? (
              <>
                {selectedOrg.logo_url ? (
                  <Image
                    src={selectedOrg.logo_url}
                    alt=""
                    width={0}
                    height={0}
                    sizes="24px"
                    className="h-5 w-auto max-w-8 rounded object-contain"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-neutral-500" aria-hidden="true" />
                )}
                <span className="font-medium">{selectedOrg.name}</span>
                <Badge variant="secondary" className={cn('text-xs', statusColors[selectedOrg.status])}>
                  {selectedOrg.status}
                </Badge>
              </>
            ) : (
              <>
                <Building2 className="h-5 w-5 text-neutral-500" aria-hidden="true" />
                <span className="text-neutral-500">Select organization</span>
              </>
            )}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          {organizations.length > 0 ? (
            <>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelectOrganization(org.id)}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{org.name}</span>
                      <Badge variant="secondary" className={cn('text-xs', statusColors[org.status])}>
                        {org.status}
                      </Badge>
                    </div>
                    {org.website_url && (
                      <span className="text-muted-foreground truncate text-xs">
                        {getDomain(org.website_url)}
                      </span>
                    )}
                  </div>
                  {org.id === selectedOrganizationId && (
                    <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New Organization
          </DropdownMenuItem>
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
