'use client'

import { useState, useCallback, startTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Plus, Building2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrganizationStatus } from '@/lib/enums'
import { useOrgId } from '@/hooks/use-org-context'
import { Button } from '@/components/ui/button'
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
import { SELO_ORG_COOKIE } from '@/lib/constants/org-storage'

interface OrgSelectorProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
}

const statusColors: Record<OrganizationStatus, string> = {
  [OrganizationStatus.Prospect]: 'bg-amber-100 text-amber-700',
  [OrganizationStatus.Customer]: 'bg-green-100 text-green-700',
  [OrganizationStatus.Inactive]: 'bg-neutral-100 text-neutral-600',
}

export function OrgSelector({ organizations, isInternal }: OrgSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentOrgId = useOrgId()
  const [dialogOpen, setDialogOpen] = useState(false)

  const selectedOrg = organizations.find((o) => o.id === currentOrgId)
  const activeOrganizations = organizations.filter((o) => o.status !== OrganizationStatus.Inactive)

  const navigateToOrg = useCallback(
    (newOrgId: string) => {
      // Update cookie for proxy redirect fallback
      document.cookie = `${SELO_ORG_COOKIE}=${newOrgId}; path=/; max-age=31536000; SameSite=Lax`

      // Replace org segment in current path
      let targetPath = pathname
      if (currentOrgId) {
        // Replace the current org UUID with the new one
        targetPath = pathname.replace(`/${currentOrgId}`, `/${newOrgId}`)
      } else {
        // No org in path currently, prepend it
        targetPath = `/${newOrgId}${pathname}`
      }

      // If on a detail page (last segment is a UUID that isn't the org), go to parent
      const segments = targetPath.split('/').filter(Boolean)
      if (segments.length > 2) {
        const lastSegment = segments[segments.length - 1]
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment)) {
          segments.pop()
          targetPath = '/' + segments.join('/')
        }
      }

      startTransition(() => {
        router.push(targetPath)
        router.refresh()
      })
    },
    [pathname, currentOrgId, router]
  )

  const handleSelectOrganization = useCallback(
    (orgId: string) => {
      navigateToOrg(orgId)
    },
    [navigateToOrg]
  )

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    handleSelectOrganization(organization.id)
  }

  const getDisplayLabel = (): React.ReactNode => {
    if (!selectedOrg) {
      return <span className="text-neutral-500">Select organization</span>
    }

    return (
      <>
        <span className="font-medium">{selectedOrg.name}</span>
        <Badge variant="secondary" className={cn('text-xs', statusColors[selectedOrg.status])}>
          {selectedOrg.status}
        </Badge>
      </>
    )
  }

  // External users see simple display (no dropdown)
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
        <span className="font-medium">{org.name}</span>
      </div>
    )
  }

  // Internal users get dropdown
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto min-h-11 gap-2 bg-white px-3 py-2 hover:bg-neutral-100"
          >
            {getDisplayLabel()}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          {/* Organizations list */}
          {activeOrganizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelectOrganization(org.id)}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{org.name}</span>
                <Badge variant="secondary" className={cn('text-xs', statusColors[org.status])}>
                  {org.status}
                </Badge>
              </div>
              {org.id === currentOrgId && (
                <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          ))}

          {activeOrganizations.length > 0 && <DropdownMenuSeparator />}
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
