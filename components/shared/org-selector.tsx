'use client'

import { useState, useEffect, useCallback, startTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Plus, Building2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OrganizationStatus } from '@/lib/enums'
import { useSetOrgId } from '@/hooks/use-org-context'
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
import { LAST_ORG_KEY, SELO_ORG_COOKIE } from '@/lib/constants/org-storage'

function setOrgCookie(orgId: string) {
  document.cookie = `${SELO_ORG_COOKIE}=${orgId}; path=/; max-age=31536000; SameSite=Lax`
}

function getOrgCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SELO_ORG_COOKIE}=([^;]*)`))
  return match ? match[1] : null
}

interface OrgSelectorProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId?: string | null
}

const statusColors: Record<OrganizationStatus, string> = {
  [OrganizationStatus.Prospect]: 'bg-amber-100 text-amber-700',
  [OrganizationStatus.Customer]: 'bg-green-100 text-green-700',
  [OrganizationStatus.Inactive]: 'bg-neutral-100 text-neutral-600',
}

export function OrgSelector({
  organizations,
  isInternal,
  selectedOrganizationId: initialSelectedOrgId,
}: OrgSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const setOrgId = useSetOrgId()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Read org from URL searchParams, falling back to prop
  const urlOrgId = searchParams.get('org')
  const serverSelectedOrgId = urlOrgId || initialSelectedOrgId

  // Local state for immediate UI updates (before server refresh completes)
  const [localOrgId, setLocalOrgId] = useState<string | null>(serverSelectedOrgId ?? null)

  // Sync local state when server value changes (adjust-during-render pattern)
  const [prevServerOrgId, setPrevServerOrgId] = useState(serverSelectedOrgId)
  if (serverSelectedOrgId !== prevServerOrgId) {
    setPrevServerOrgId(serverSelectedOrgId)
    setLocalOrgId(serverSelectedOrgId ?? null)
  }

  const selectedOrganizationId = localOrgId

  const selectedOrg = organizations.find((o) => o.id === selectedOrganizationId)
  const activeOrganizations = organizations.filter((o) => o.status !== OrganizationStatus.Inactive)

  // Navigate to an org — updates external systems (localStorage, cookie, URL) without React state.
  // Safe to call from effects since it only touches external systems.
  const navigateToOrg = useCallback(
    (orgId: string) => {
      localStorage.setItem(LAST_ORG_KEY, orgId)
      setOrgCookie(orgId)
      setOrgId(orgId)

      const url = new URL(window.location.href)
      url.searchParams.set('org', orgId)
      const newUrl = pathname + url.search

      startTransition(() => {
        router.push(newUrl)
        router.refresh()
      })
    },
    [pathname, router, setOrgId]
  )

  // User-initiated org selection — immediate UI update + navigation
  const handleSelectOrganization = useCallback(
    (orgId: string) => {
      setLocalOrgId(orgId)
      navigateToOrg(orgId)
    },
    [navigateToOrg]
  )

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    handleSelectOrganization(organization.id)
  }

  // Sync cookie when URL org changes (e.g. direct link with ?org=)
  useEffect(() => {
    if (urlOrgId) {
      setOrgCookie(urlOrgId)
      localStorage.setItem(LAST_ORG_KEY, urlOrgId)
    }
  }, [urlOrgId])

  // One-time migration: if localStorage has an org but cookie doesn't, set the cookie.
  // This ensures existing users get server-side org resolution on their next page load.
  useEffect(() => {
    const cookieOrg = getOrgCookie()
    if (!cookieOrg) {
      const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
      if (lastOrgId) {
        setOrgCookie(lastOrgId)
      }
    }
  }, [])

  // If no org is selected, restore the last used org or pick the first active one.
  useEffect(() => {
    if (selectedOrganizationId || activeOrganizations.length === 0) return

    const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
    if (lastOrgId && activeOrganizations.some((o) => o.id === lastOrgId)) {
      navigateToOrg(lastOrgId)
    } else {
      navigateToOrg(activeOrganizations[0].id)
    }
  }, [selectedOrganizationId, activeOrganizations, navigateToOrg])

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
              {org.id === selectedOrganizationId && (
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
