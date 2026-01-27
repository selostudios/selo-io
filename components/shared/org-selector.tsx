'use client'

import { useState, useEffect, startTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Plus, Building2, Check, Link2 } from 'lucide-react'
import Image from 'next/image'
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
import { CreateOrganizationDialog } from '@/components/dashboard/create-organization-dialog'
import type { OrganizationForSelector } from '@/lib/organizations/types'

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_VIEW_KEY = 'selo-last-view-type'
const CHILD_SIDEBAR_COLLAPSED_KEY = 'child-sidebar-collapsed'

interface OrgSelectorProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId?: string | null
}

// SEO routes where "One-time URL" option should appear
const SEO_ROUTES = ['/seo/site-audit', '/seo/page-speed', '/seo/aio']

const statusColors: Record<string, string> = {
  prospect: 'bg-amber-100 text-amber-700',
  customer: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
}

export function OrgSelector({
  organizations,
  isInternal,
  selectedOrganizationId: initialSelectedOrgId,
}: OrgSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)

  // Determine if we're on an SEO route
  const isSeoRoute = SEO_ROUTES.some((route) => pathname.startsWith(route))

  // Read org from URL searchParams, falling back to prop
  const urlOrgId = searchParams.get('org')
  const selectedOrganizationId = urlOrgId || initialSelectedOrgId

  // Check if one-time mode is active (only relevant on SEO routes)
  const isOneTimeMode = isSeoRoute && !selectedOrganizationId

  const selectedOrg = organizations.find((o) => o.id === selectedOrganizationId)
  const activeOrganizations = organizations.filter((o) => o.status !== 'inactive')

  const handleSelectOrganization = (orgId: string) => {
    localStorage.setItem(LAST_ORG_KEY, orgId)
    localStorage.setItem(LAST_VIEW_KEY, 'organization')
    localStorage.setItem(CHILD_SIDEBAR_COLLAPSED_KEY, 'false')
    window.dispatchEvent(new Event('sidebar-expand'))

    // Update URL - Next.js will automatically re-render Server Components with new searchParams
    const url = new URL(window.location.href)
    url.searchParams.set('org', orgId)
    const newUrl = pathname + url.search

    router.push(newUrl)
  }

  const handleSelectOneTime = () => {
    localStorage.removeItem(LAST_ORG_KEY)
    localStorage.setItem(LAST_VIEW_KEY, 'one-time')

    // Remove org param from URL and refresh to re-fetch server data
    startTransition(() => {
      router.push(pathname)
      router.refresh()
    })
  }

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    handleSelectOrganization(organization.id)
  }

  // Initialize from localStorage when no org is selected
  useEffect(() => {
    if (!selectedOrganizationId && activeOrganizations.length > 0) {
      // For non-SEO routes, always select an org
      if (!isSeoRoute) {
        const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
        if (lastOrgId && activeOrganizations.some((o) => o.id === lastOrgId)) {
          handleSelectOrganization(lastOrgId)
        } else {
          handleSelectOrganization(activeOrganizations[0].id)
        }
        return
      }

      // For SEO routes, check if we should restore one-time mode
      const lastViewType = localStorage.getItem(LAST_VIEW_KEY)
      if (lastViewType === 'one-time') {
        // Already in one-time mode, do nothing
        return
      }

      // Try to restore last org if it has a website URL
      const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
      if (lastOrgId) {
        const org = activeOrganizations.find((o) => o.id === lastOrgId)
        if (org?.website_url) {
          handleSelectOrganization(lastOrgId)
        }
      }
    }
  }, [selectedOrganizationId, activeOrganizations.length, isSeoRoute]) // eslint-disable-line react-hooks/exhaustive-deps

  const getDomain = (url: string | null): string => {
    if (!url) return ''
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const getDisplayLabel = (): React.ReactNode => {
    if (isOneTimeMode) {
      return (
        <span className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
          <span className="truncate">One-time Audits</span>
        </span>
      )
    }

    if (!selectedOrg) {
      return <span className="text-neutral-500">Select organization</span>
    }

    return (
      <>
        {selectedOrg.logo_url ? (
          <Image
            src={selectedOrg.logo_url}
            alt=""
            width={0}
            height={0}
            sizes="100px"
            className="h-7 w-auto max-w-24 rounded object-contain"
          />
        ) : (
          <Building2 className="h-6 w-6 text-neutral-500" aria-hidden="true" />
        )}
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
        {org.logo_url ? (
          <Image
            src={org.logo_url}
            alt=""
            width={0}
            height={0}
            sizes="100px"
            className="h-7 w-auto max-w-24 rounded object-contain"
          />
        ) : (
          <Building2 className="h-4 w-4 text-neutral-500" aria-hidden="true" />
        )}
        <span className="font-medium">{org.name}</span>
        {isSeoRoute && org.website_url && (
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
          <Button
            variant="ghost"
            className="h-auto min-h-11 gap-2 bg-white px-3 py-2 hover:bg-neutral-100"
          >
            {getDisplayLabel()}
            <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          {/* One-time URL option (only on SEO routes) */}
          {isSeoRoute && (
            <>
              <DropdownMenuItem onClick={handleSelectOneTime}>
                <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Enter one-time URL…
                {isOneTimeMode && (
                  <Check className="ml-auto h-4 w-4 text-green-600" aria-hidden="true" />
                )}
              </DropdownMenuItem>
              {activeOrganizations.length > 0 && <DropdownMenuSeparator />}
            </>
          )}

          {/* Organizations list */}
          {activeOrganizations.map((org) => {
            const isDisabled = isSeoRoute && !org.website_url
            return (
              <DropdownMenuItem
                key={org.id}
                onClick={() => !isDisabled && handleSelectOrganization(org.id)}
                className="flex items-center justify-between py-2"
                disabled={isDisabled}
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
                  {isSeoRoute &&
                    (org.website_url ? (
                      <span className="text-muted-foreground truncate text-xs">
                        {getDomain(org.website_url)}
                      </span>
                    ) : (
                      <span className="truncate text-xs text-neutral-400">No website URL</span>
                    ))}
                </div>
                {org.id === selectedOrganizationId && (
                  <Check className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                )}
              </DropdownMenuItem>
            )
          })}

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
