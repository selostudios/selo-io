'use client'

import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgSelector } from '@/components/shared/org-selector'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface SeoHeaderProps {
  userEmail: string
  firstName: string
  lastName: string
  role: string
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

export function SeoHeader({
  userEmail,
  firstName,
  lastName,
  role,
  organizations,
  isInternal,
  selectedOrganizationId,
}: SeoHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <OrgSelector
        organizations={organizations}
        isInternal={isInternal}
        selectedOrganizationId={selectedOrganizationId}
      />
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
