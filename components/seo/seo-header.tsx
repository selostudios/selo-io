'use client'

import { useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { AuditTargetSelector, type AuditTarget } from '@/components/seo/audit-target-selector'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface SeoHeaderProps {
  userEmail: string
  firstName: string
  lastName: string
  role: string
  organizations: OrganizationForSelector[]
  isInternal: boolean
}

const LAST_ORG_KEY = 'selo-last-organization-id'
const LAST_VIEW_KEY = 'selo-last-view-type'

function getInitialTarget(
  selectedOrganizationId: string | null,
  organizations: OrganizationForSelector[]
): AuditTarget {
  // If an organization is selected via URL param
  if (selectedOrganizationId) {
    const org = organizations.find((o) => o.id === selectedOrganizationId)
    if (org?.website_url) {
      return {
        type: 'organization',
        organizationId: org.id,
        url: org.website_url,
      }
    }
  }

  // Check localStorage for last view type
  if (typeof window !== 'undefined') {
    const lastViewType = localStorage.getItem(LAST_VIEW_KEY)
    if (lastViewType === 'one-time') {
      return { type: 'one-time' }
    }
  }

  // Check localStorage for last selected org
  if (typeof window !== 'undefined') {
    const lastOrgId = localStorage.getItem(LAST_ORG_KEY)
    if (lastOrgId) {
      const org = organizations.find((o) => o.id === lastOrgId)
      if (org?.website_url) {
        return {
          type: 'organization',
          organizationId: org.id,
          url: org.website_url,
        }
      }
    }
  }

  // Fall back to first organization with a website URL
  const firstOrgWithUrl = organizations.find((o) => o.website_url)
  if (firstOrgWithUrl) {
    return {
      type: 'organization',
      organizationId: firstOrgWithUrl.id,
      url: firstOrgWithUrl.website_url!,
    }
  }

  return null
}

export function SeoHeader({
  userEmail,
  firstName,
  lastName,
  role,
  organizations,
  isInternal,
}: SeoHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedOrgId = searchParams.get('org')

  // Derive selected target from URL params and organizations
  const selectedTarget = useMemo(
    () => getInitialTarget(selectedOrgId, organizations),
    [selectedOrgId, organizations]
  )

  const handleTargetChange = (target: AuditTarget) => {
    // Update URL and localStorage when target changes
    if (target?.type === 'organization') {
      localStorage.setItem(LAST_ORG_KEY, target.organizationId)
      localStorage.setItem(LAST_VIEW_KEY, 'organization')

      // Preserve current pathname, just update org param
      const newUrl = `${pathname}?org=${target.organizationId}`
      router.push(newUrl)
    } else if (target?.type === 'one-time') {
      localStorage.removeItem(LAST_ORG_KEY)
      localStorage.setItem(LAST_VIEW_KEY, 'one-time')

      // Remove org param from URL
      router.push(pathname)
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <AuditTargetSelector
        organizations={organizations}
        selectedTarget={selectedTarget}
        onTargetChange={handleTargetChange}
        isInternal={isInternal}
      />
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
