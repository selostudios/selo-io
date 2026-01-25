# Organization Status & Internal Users Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Selo employees to manage prospect organizations for auditing, with a clear conversion path to customers.

**Architecture:** Internal users (Selo employees) can see all organizations and run audits on any URL. External users (customers) can only see and audit their own organization. Organizations have a status lifecycle: prospect → customer → inactive.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + RLS), TypeScript, Shadcn UI

---

## Phase 1: Database Migration

### Task 1.1: Create Database Migration File

**Files:**
- Create: `supabase/migrations/20260125000001_organization_status_internal_users.sql`

**Step 1: Write the migration**

```sql
-- Organization Status & Internal Users Migration
-- This migration:
-- 1. Adds is_internal flag to users (Selo employees)
-- 2. Makes organization_id nullable for internal users
-- 3. Adds status enum to organizations (prospect, customer, inactive)
-- 4. Adds contact_email to organizations (required for customer conversion)
-- 5. Drops seo_projects table and project_id columns
-- 6. Updates RLS policies for new access patterns

-- Step 1: Create organization status enum
CREATE TYPE organization_status AS ENUM ('prospect', 'customer', 'inactive');

-- Step 2: Add columns to users table
ALTER TABLE users ADD COLUMN is_internal BOOLEAN DEFAULT false;
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

-- Step 3: Add columns to organizations table
ALTER TABLE organizations ADD COLUMN status organization_status DEFAULT 'prospect';
ALTER TABLE organizations ADD COLUMN contact_email TEXT;

-- Step 4: Set existing organizations to 'customer' status (they're already onboarded)
UPDATE organizations SET status = 'customer' WHERE status IS NULL OR status = 'prospect';

-- Step 5: Drop project_id from audit tables
ALTER TABLE site_audits DROP COLUMN IF EXISTS project_id;
ALTER TABLE performance_audits DROP COLUMN IF EXISTS project_id;

-- Step 6: Drop seo_projects table
DROP TABLE IF EXISTS seo_projects;

-- Step 7: Update RLS policies for organizations

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;
DROP POLICY IF EXISTS "org_select_policy" ON organizations;
DROP POLICY IF EXISTS "org_update_policy" ON organizations;
DROP POLICY IF EXISTS "org_insert_policy" ON organizations;

-- New policy: Internal users see all orgs, external see own org
CREATE POLICY "View organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- New policy: Only internal users can create organizations
CREATE POLICY "Create organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
  );

-- New policy: Internal users can update any org, external admins can update own org
CREATE POLICY "Update organizations"
  ON organizations FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    id IN (SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Step 8: Update RLS policies for site_audits

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admins and team members can manage site audits" ON site_audits;
DROP POLICY IF EXISTS "Users can view site audits in their organization" ON site_audits;
DROP POLICY IF EXISTS "site_audits_select_policy" ON site_audits;
DROP POLICY IF EXISTS "site_audits_insert_policy" ON site_audits;
DROP POLICY IF EXISTS "site_audits_update_policy" ON site_audits;
DROP POLICY IF EXISTS "site_audits_delete_policy" ON site_audits;

-- New policy: View site audits
-- Internal: can view all audits
-- External: can view own org's audits
CREATE POLICY "View site audits"
  ON site_audits FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- New policy: Create site audits
-- Internal: can create for any org or one-time (null org_id)
-- External: can only create for their own org
CREATE POLICY "Create site audits"
  ON site_audits FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    ))
  );

-- New policy: Update site audits (same as view)
CREATE POLICY "Update site audits"
  ON site_audits FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- New policy: Delete site audits (same as view)
CREATE POLICY "Delete site audits"
  ON site_audits FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Step 9: Update RLS policies for performance_audits (same pattern)

DROP POLICY IF EXISTS "Users can view performance audits in their organization" ON performance_audits;
DROP POLICY IF EXISTS "Admins and team members can manage performance audits" ON performance_audits;
DROP POLICY IF EXISTS "performance_audits_select_policy" ON performance_audits;
DROP POLICY IF EXISTS "performance_audits_insert_policy" ON performance_audits;
DROP POLICY IF EXISTS "performance_audits_update_policy" ON performance_audits;
DROP POLICY IF EXISTS "performance_audits_delete_policy" ON performance_audits;

CREATE POLICY "View performance audits"
  ON performance_audits FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Create performance audits"
  ON performance_audits FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Update performance audits"
  ON performance_audits FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Delete performance audits"
  ON performance_audits FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
    OR
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

-- Step 10: Create index for is_internal queries
CREATE INDEX idx_users_is_internal ON users(is_internal) WHERE is_internal = true;
```

**Step 2: Commit the migration**

```bash
git add supabase/migrations/20260125000001_organization_status_internal_users.sql
git commit -m "feat(db): add organization status and internal users migration"
```

---

## Phase 2: TypeScript Types

### Task 2.1: Create Organization Types

**Files:**
- Create: `lib/organizations/types.ts`

**Step 1: Write the types file**

```typescript
export type OrganizationStatus = 'prospect' | 'customer' | 'inactive'

export interface Organization {
  id: string
  name: string
  website_url: string | null
  status: OrganizationStatus
  industry: string | null
  contact_email: string | null
  contact_info: Record<string, unknown> | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationForSelector {
  id: string
  name: string
  website_url: string | null
  status: OrganizationStatus
}

export interface CreateOrganizationInput {
  name: string
  websiteUrl: string
}

export interface ConvertToCustomerInput {
  organizationId: string
  industry: string
  contactEmail: string
}
```

**Step 2: Commit**

```bash
git add lib/organizations/types.ts
git commit -m "feat: add organization types"
```

---

## Phase 3: Organization Server Actions

### Task 3.1: Create Organization Actions

**Files:**
- Create: `lib/organizations/actions.ts`

**Step 1: Write the actions file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  Organization,
  OrganizationForSelector,
  OrganizationStatus,
} from './types'

/**
 * Check if the current user is internal (Selo employee)
 */
export async function isInternalUser(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  return userRecord?.is_internal === true
}

/**
 * Get current user info including internal status and org
 */
export async function getCurrentUser(): Promise<{
  id: string
  isInternal: boolean
  organizationId: string | null
} | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal, organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) return null

  return {
    id: user.id,
    isInternal: userRecord.is_internal === true,
    organizationId: userRecord.organization_id,
  }
}

/**
 * Get all organizations (internal users see all, external see own)
 */
export async function getOrganizations(): Promise<OrganizationForSelector[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // RLS handles filtering - internal sees all, external sees own
  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name, website_url, status')
    .order('name', { ascending: true })

  if (error) {
    console.error('[Organizations Error]', {
      type: 'fetch_organizations_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return []
  }

  return (organizations ?? []) as OrganizationForSelector[]
}

/**
 * Get a single organization by ID
 */
export async function getOrganization(id: string): Promise<Organization | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: organization, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'fetch_organization_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return null
  }

  return organization as Organization
}

/**
 * Create a new prospect organization (internal users only)
 */
export async function createOrganization(
  name: string,
  websiteUrl: string
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is internal
  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord?.is_internal) {
    return { success: false, error: 'Only internal users can create organizations' }
  }

  // Validate URL
  try {
    const parsed = new URL(websiteUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, error: 'URL must use http or https protocol' }
    }
  } catch {
    return { success: false, error: 'Invalid URL format' }
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .insert({
      name: name.trim(),
      website_url: websiteUrl.trim(),
      status: 'prospect',
    })
    .select()
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'create_organization_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to create organization' }
  }

  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')
  revalidatePath('/dashboard')

  return { success: true, organization: organization as Organization }
}

/**
 * Convert a prospect to customer (internal users only)
 */
export async function convertToCustomer(
  organizationId: string,
  industry: string,
  contactEmail: string
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is internal
  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord?.is_internal) {
    return { success: false, error: 'Only internal users can convert organizations' }
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(contactEmail)) {
    return { success: false, error: 'Invalid email format' }
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .update({
      status: 'customer',
      industry: industry.trim(),
      contact_email: contactEmail.trim(),
    })
    .eq('id', organizationId)
    .select()
    .single()

  if (error) {
    console.error('[Organizations Error]', {
      type: 'convert_organization_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to convert organization' }
  }

  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')
  revalidatePath('/dashboard')
  revalidatePath(`/settings/organization`)

  return { success: true, organization: organization as Organization }
}

/**
 * Update organization status (internal users only)
 */
export async function updateOrganizationStatus(
  organizationId: string,
  status: OrganizationStatus
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is internal
  const { data: userRecord } = await supabase
    .from('users')
    .select('is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord?.is_internal) {
    return { success: false, error: 'Only internal users can update organization status' }
  }

  const { error } = await supabase
    .from('organizations')
    .update({ status })
    .eq('id', organizationId)

  if (error) {
    console.error('[Organizations Error]', {
      type: 'update_organization_status_failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    })
    return { success: false, error: 'Failed to update organization status' }
  }

  revalidatePath('/seo/site-audit')
  revalidatePath('/seo/page-speed')
  revalidatePath('/dashboard')

  return { success: true }
}
```

**Step 2: Commit**

```bash
git add lib/organizations/actions.ts
git commit -m "feat: add organization server actions"
```

---

## Phase 4: Organization Selector Component

### Task 4.1: Create Organization Selector

**Files:**
- Create: `components/dashboard/organization-selector.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  selectedOrganizationId,
}: OrganizationSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [dialogOpen, setDialogOpen] = useState(false)

  const selectedOrg = organizations.find((o) => o.id === selectedOrganizationId)

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

  const handleSelectOrganization = (orgId: string) => {
    localStorage.setItem(LAST_ORG_KEY, orgId)
    // Add org param to current URL
    const url = new URL(window.location.href)
    url.searchParams.set('org', orgId)
    router.push(url.pathname + url.search)
  }

  const handleOrganizationCreated = (organization: OrganizationForSelector) => {
    setDialogOpen(false)
    handleSelectOrganization(organization.id)
  }

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
          <Button
            variant="ghost"
            className="h-auto gap-2 px-3 py-2 hover:bg-neutral-100"
          >
            {selectedOrg ? (
              <>
                <Building2 className="h-4 w-4 text-neutral-500" />
                <span className="font-medium">{selectedOrg.name}</span>
                <Badge
                  variant="secondary"
                  className={cn('text-xs', statusColors[selectedOrg.status])}
                >
                  {selectedOrg.status}
                </Badge>
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 text-neutral-500" />
                <span className="text-neutral-500">Select organization</span>
              </>
            )}
            <ChevronDown className="h-4 w-4 text-neutral-400" />
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
                      <Badge
                        variant="secondary"
                        className={cn('text-xs', statusColors[org.status])}
                      >
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
                    <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
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
```

**Step 2: Commit**

```bash
git add components/dashboard/organization-selector.tsx
git commit -m "feat: add organization selector component"
```

---

### Task 4.2: Create Organization Dialog

**Files:**
- Create: `components/dashboard/create-organization-dialog.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOrganization } from '@/lib/organizations/actions'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (organization: OrganizationForSelector) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const result = await createOrganization(name, websiteUrl)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to create organization')
      return
    }

    // Reset form
    setName('')
    setWebsiteUrl('')

    // Notify parent
    if (result.organization) {
      onSuccess({
        id: result.organization.id,
        name: result.organization.name,
        website_url: result.organization.website_url,
        status: result.organization.status,
      })
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form on close
      setName('')
      setWebsiteUrl('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
            <DialogDescription>
              Create a prospect organization to start running audits.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                required
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name || !websiteUrl}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add components/dashboard/create-organization-dialog.tsx
git commit -m "feat: add create organization dialog"
```

---

## Phase 5: Update Header Component

### Task 5.1: Update Header for Internal Users

**Files:**
- Modify: `components/dashboard/header.tsx`

**Step 1: Update the header**

Replace the entire file with:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgLogo } from '@/components/dashboard/org-logo'
import { OrganizationSelector } from '@/components/dashboard/organization-selector'
import { getOrganizations, getOrganization } from '@/lib/organizations/actions'

interface HeaderProps {
  selectedOrgId?: string | null
}

export async function Header({ selectedOrgId }: HeaderProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord, error } = await supabase
    .from('users')
    .select(
      'organization_id, is_internal, first_name, last_name, role'
    )
    .eq('id', user.id)
    .single()

  if (error || !userRecord) {
    redirect('/login')
  }

  const userEmail = user?.email || ''
  const firstName = userRecord?.first_name || userEmail.split('@')[0]
  const lastName = userRecord?.last_name || ''
  const role = userRecord?.role || 'team_member'
  const isInternal = userRecord?.is_internal === true

  // Internal users: show organization selector
  if (isInternal) {
    const organizations = await getOrganizations()
    const selectedOrg = selectedOrgId ? await getOrganization(selectedOrgId) : null

    return (
      <header className="flex h-16 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <OrganizationSelector
            organizations={organizations}
            selectedOrganizationId={selectedOrgId}
          />
        </div>
        <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
      </header>
    )
  }

  // External users: show their organization
  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url, primary_color')
    .eq('id', userRecord.organization_id)
    .single()

  const orgName = org?.name || 'Organization'
  const logoUrl = org?.logo_url || null
  const primaryColor = org?.primary_color || null

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        <OrgLogo logoUrl={logoUrl} orgName={orgName} primaryColor={primaryColor} size={40} />
        <h2 className="text-lg font-semibold">{orgName}</h2>
      </div>
      <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
    </header>
  )
}
```

**Step 2: Commit**

```bash
git add components/dashboard/header.tsx
git commit -m "feat: update header to show org selector for internal users"
```

---

## Phase 6: Update Audit Target Selector

### Task 6.1: Create Audit Target Selector

**Files:**
- Create: `components/seo/audit-target-selector.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, Building2, Link2, Plus, Check } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { CreateOrganizationDialog } from '@/components/dashboard/create-organization-dialog'
import type { OrganizationForSelector } from '@/lib/organizations/types'

type AuditTarget =
  | { type: 'organization'; organizationId: string; url: string }
  | { type: 'one-time'; url: string }
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
  const [oneTimeUrl, setOneTimeUrl] = useState('')
  const [showOneTimeInput, setShowOneTimeInput] = useState(false)

  // For external users, auto-select their org if not selected
  if (!isInternal && organizations.length === 1 && !selectedTarget) {
    const org = organizations[0]
    if (org.website_url) {
      onTargetChange({
        type: 'organization',
        organizationId: org.id,
        url: org.website_url,
      })
    }
  }

  const getDomain = (url: string | null): string => {
    if (!url) return ''
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const getDisplayText = (): string => {
    if (!selectedTarget) return 'Select target...'
    if (selectedTarget.type === 'one-time') {
      return getDomain(selectedTarget.url) || selectedTarget.url
    }
    const org = organizations.find((o) => o.id === selectedTarget.organizationId)
    return org?.name || 'Unknown organization'
  }

  const handleSelectOrganization = (org: OrganizationForSelector) => {
    if (!org.website_url) return
    onTargetChange({
      type: 'organization',
      organizationId: org.id,
      url: org.website_url,
    })
    setShowOneTimeInput(false)
  }

  const handleOneTimeUrlSubmit = () => {
    if (!oneTimeUrl) return
    try {
      new URL(oneTimeUrl) // Validate URL
      onTargetChange({
        type: 'one-time',
        url: oneTimeUrl,
      })
      setShowOneTimeInput(false)
    } catch {
      // Invalid URL - do nothing
    }
  }

  const handleOrganizationCreated = (org: OrganizationForSelector) => {
    setDialogOpen(false)
    if (org.website_url) {
      onTargetChange({
        type: 'organization',
        organizationId: org.id,
        url: org.website_url,
      })
    }
  }

  // External users: simplified view
  if (!isInternal) {
    const org = organizations[0]
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        <Building2 className="h-4 w-4" />
        <span>{org?.name}</span>
        {org?.website_url && (
          <span className="text-neutral-400">({getDomain(org.website_url)})</span>
        )}
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[250px] justify-between">
            <span className="truncate">{getDisplayText()}</span>
            <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px]">
          {/* One-time URL option */}
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault()
              setShowOneTimeInput(true)
            }}
          >
            <Link2 className="mr-2 h-4 w-4" />
            Enter one-time URL...
          </DropdownMenuItem>

          {/* Create new org option */}
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create new organization...
          </DropdownMenuItem>

          {organizations.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelectOrganization(org)}
                  disabled={!org.website_url}
                  className="flex items-center justify-between py-2"
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
                      <span className="truncate text-xs text-amber-600">
                        No website URL
                      </span>
                    )}
                  </div>
                  {selectedTarget?.type === 'organization' &&
                    selectedTarget.organizationId === org.id && (
                      <Check className="h-4 w-4 flex-shrink-0 text-green-600" />
                    )}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* One-time URL input */}
      {showOneTimeInput && (
        <div className="flex items-center gap-2">
          <Input
            type="url"
            placeholder="https://example.com"
            value={oneTimeUrl}
            onChange={(e) => setOneTimeUrl(e.target.value)}
            className="w-[300px]"
            autoFocus
          />
          <Button size="sm" onClick={handleOneTimeUrlSubmit}>
            Use URL
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowOneTimeInput(false)
              setOneTimeUrl('')
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      <CreateOrganizationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleOrganizationCreated}
      />
    </>
  )
}

export type { AuditTarget }
```

**Step 2: Commit**

```bash
git add components/seo/audit-target-selector.tsx
git commit -m "feat: add audit target selector component"
```

---

## Phase 7: Update Site Audit Page

### Task 7.1: Update Site Audit Actions

**Files:**
- Modify: `app/seo/site-audit/actions.ts`

**Step 1: Replace the file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getOrganizations, getCurrentUser } from '@/lib/organizations/actions'
import type { SiteAudit } from '@/lib/audit/types'

export async function getSiteAuditData(organizationId?: string) {
  const supabase = await createClient()

  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/login')

  const { isInternal, organizationId: userOrgId } = currentUser

  // Determine which org to filter by
  let filterOrgId: string | null = null
  if (isInternal) {
    // Internal users can filter by any org or see all
    filterOrgId = organizationId || null
  } else {
    // External users can only see their own org
    filterOrgId = userOrgId
  }

  // Build audits query
  let auditsQuery = supabase
    .from('site_audits')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    auditsQuery = auditsQuery.eq('organization_id', filterOrgId)
  }

  const { data: audits } = await auditsQuery

  // Build archived audits query
  let archivedQuery = supabase
    .from('site_audits')
    .select('*')
    .not('archived_at', 'is', null)
    .order('created_at', { ascending: false })

  if (filterOrgId) {
    archivedQuery = archivedQuery.eq('organization_id', filterOrgId)
  }

  const { data: archivedAudits } = await archivedQuery

  // Get organizations for selector (internal sees all, external sees own)
  const organizations = await getOrganizations()

  return {
    audits: (audits ?? []) as SiteAudit[],
    archivedAudits: (archivedAudits ?? []) as SiteAudit[],
    organizations,
    isInternal,
    selectedOrganizationId: filterOrgId,
  }
}
```

**Step 2: Commit**

```bash
git add app/seo/site-audit/actions.ts
git commit -m "feat: update site audit actions for org-based filtering"
```

---

### Task 7.2: Update Site Audit Page

**Files:**
- Modify: `app/seo/site-audit/page.tsx`

**Step 1: Replace the file**

```typescript
import { getSiteAuditData } from './actions'
import { SiteAuditClient } from './client'

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function SiteAuditPage({ searchParams }: PageProps) {
  const { org: organizationId } = await searchParams
  const data = await getSiteAuditData(organizationId)

  return <SiteAuditClient {...data} />
}
```

**Step 2: Create the client component**

Create file `app/seo/site-audit/client.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileSearch } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditDashboard } from '@/components/audit/audit-dashboard'
import { AuditTargetSelector, type AuditTarget } from '@/components/seo/audit-target-selector'
import type { SiteAudit } from '@/lib/audit/types'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface SiteAuditClientProps {
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
  organizations: OrganizationForSelector[]
  isInternal: boolean
  selectedOrganizationId: string | null
}

export function SiteAuditClient({
  audits,
  archivedAudits,
  organizations,
  isInternal,
  selectedOrganizationId,
}: SiteAuditClientProps) {
  const router = useRouter()

  // Determine selected target from URL/data
  const selectedOrg = selectedOrganizationId
    ? organizations.find((o) => o.id === selectedOrganizationId)
    : null

  const [selectedTarget, setSelectedTarget] = useState<AuditTarget>(
    selectedOrg?.website_url
      ? {
          type: 'organization',
          organizationId: selectedOrg.id,
          url: selectedOrg.website_url,
        }
      : null
  )

  // Handle target change - update URL for org selections
  const handleTargetChange = (target: AuditTarget) => {
    setSelectedTarget(target)
    if (target?.type === 'organization') {
      router.push(`/seo/site-audit?org=${target.organizationId}`)
    } else if (target?.type === 'one-time') {
      router.push('/seo/site-audit')
    }
  }

  // Auto-select for external users
  useEffect(() => {
    if (!isInternal && organizations.length > 0 && !selectedTarget) {
      const org = organizations[0]
      if (org.website_url) {
        setSelectedTarget({
          type: 'organization',
          organizationId: org.id,
          url: org.website_url,
        })
      }
    }
  }, [isInternal, organizations, selectedTarget])

  const websiteUrl = selectedTarget?.url || null
  const currentOrgId = selectedTarget?.type === 'organization' ? selectedTarget.organizationId : null

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <FileSearch className="mt-1 h-8 w-8 text-neutral-700" />
        <div>
          <h1 className="text-3xl font-bold">Site Audit</h1>
          <p className="text-muted-foreground">
            Crawl and analyze websites for SEO issues, missing meta tags, broken links, and
            technical problems
          </p>
        </div>
      </div>

      {/* Target Selector */}
      <div className="flex items-center gap-4">
        <AuditTargetSelector
          organizations={organizations}
          selectedTarget={selectedTarget}
          onTargetChange={handleTargetChange}
          isInternal={isInternal}
        />
      </div>

      {/* No organizations message for internal users */}
      {isInternal && organizations.length === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" />
            </div>
            <CardTitle>No Organizations Yet</CardTitle>
            <CardDescription>
              Create an organization to start running site audits, or enter a one-time URL.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Show dashboard when URL is selected */}
      {websiteUrl && (
        <AuditDashboard
          websiteUrl={websiteUrl}
          audits={audits}
          archivedAudits={archivedAudits}
          organizationId={currentOrgId}
        />
      )}

      {/* Prompt to select target */}
      {!websiteUrl && isInternal && organizations.length > 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <FileSearch className="h-6 w-6 text-neutral-600" />
            </div>
            <CardTitle>Select a Target</CardTitle>
            <CardDescription>
              Choose an organization from the selector above, or enter a one-time URL.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/seo/site-audit/page.tsx app/seo/site-audit/client.tsx
git commit -m "feat: update site audit page for org-based selection"
```

---

## Phase 8: Update Audit Dashboard & API

### Task 8.1: Update Audit Dashboard Props

**Files:**
- Modify: `components/audit/audit-dashboard.tsx`

**Step 1: Update the component props**

Find the interface and update `projectId` to `organizationId`:

```typescript
// Change this:
interface AuditDashboardProps {
  websiteUrl: string
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
  projectId?: string
}

// To this:
interface AuditDashboardProps {
  websiteUrl: string
  audits: SiteAudit[]
  archivedAudits: SiteAudit[]
  organizationId?: string | null
}
```

Then find where `projectId` is used in the `handleRunAudit` function and change to `organizationId`:

```typescript
// Change this:
body: JSON.stringify({ projectId }),

// To this:
body: JSON.stringify({ organizationId, url: websiteUrl }),
```

**Step 2: Commit**

```bash
git add components/audit/audit-dashboard.tsx
git commit -m "feat: update audit dashboard to use organizationId"
```

---

### Task 8.2: Update Audit API Route

**Files:**
- Modify: `app/api/audit/start/route.ts`

**Step 1: Replace the file**

```typescript
import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAudit } from '@/lib/audit/runner'

export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { organizationId, url } = body as { organizationId?: string; url?: string }

  // Get user info
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const isInternal = userRecord.is_internal === true
  let websiteUrl: string
  let auditOrgId: string | null = null

  // Determine URL and org based on request
  if (url) {
    // URL provided directly (one-time or from org)
    websiteUrl = url

    // If organizationId provided, verify access
    if (organizationId) {
      if (isInternal) {
        // Internal users can audit any org
        auditOrgId = organizationId
      } else {
        // External users can only audit their own org
        if (organizationId !== userRecord.organization_id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }
        auditOrgId = organizationId
      }
    } else if (!isInternal) {
      // External users without org must use their own org
      auditOrgId = userRecord.organization_id
    }
    // Internal users can do one-time audits (auditOrgId stays null)
  } else if (organizationId) {
    // Get URL from organization
    const { data: org } = await supabase
      .from('organizations')
      .select('website_url')
      .eq('id', organizationId)
      .single()

    if (!org?.website_url) {
      return NextResponse.json({ error: 'Organization has no website URL' }, { status: 400 })
    }

    // Verify access
    if (!isInternal && organizationId !== userRecord.organization_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    websiteUrl = org.website_url
    auditOrgId = organizationId
  } else {
    // Fallback for external users - use their org
    if (!userRecord.organization_id) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('website_url')
      .eq('id', userRecord.organization_id)
      .single()

    if (!org?.website_url) {
      return NextResponse.json({ error: 'No website URL configured' }, { status: 400 })
    }

    websiteUrl = org.website_url
    auditOrgId = userRecord.organization_id
  }

  // Create audit record
  const { data: audit, error } = await supabase
    .from('site_audits')
    .insert({
      organization_id: auditOrgId,
      url: websiteUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[Audit API] Failed to create audit:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }

  after(async () => {
    try {
      await runAudit(audit.id, websiteUrl)
    } catch (err) {
      console.error('[Audit API] Background audit failed:', err)
    }
  })

  return NextResponse.json({ auditId: audit.id })
}
```

**Step 2: Commit**

```bash
git add app/api/audit/start/route.ts
git commit -m "feat: update audit API for org-based and one-time audits"
```

---

## Phase 9: Clean Up Old Files

### Task 9.1: Remove Project-Related Files

**Files:**
- Delete: `components/seo/project-selector.tsx`
- Delete: `components/seo/project-dialog.tsx`
- Delete: `lib/seo/actions.ts`

**Step 1: Delete the files**

```bash
rm components/seo/project-selector.tsx
rm components/seo/project-dialog.tsx
rm lib/seo/actions.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove seo_projects related files"
```

---

## Phase 10: Update Page Speed (Similar Pattern)

### Task 10.1: Update Page Speed Actions & Page

Apply the same pattern as site-audit to page-speed:

**Files:**
- Modify: `app/seo/page-speed/actions.ts`
- Modify: `app/seo/page-speed/page.tsx`
- Create: `app/seo/page-speed/client.tsx`
- Modify: `app/api/performance/start/route.ts`

Follow the same pattern as Phase 7 and 8.

**Step 1: Commit after changes**

```bash
git add app/seo/page-speed/
git commit -m "feat: update page speed for org-based selection"
```

---

## Phase 11: Update Dashboard Layout

### Task 11.1: Pass Org ID to Header

**Files:**
- Modify: `app/dashboard/layout.tsx`
- Modify: `app/seo/layout.tsx`

Update layouts to pass `selectedOrgId` from searchParams to Header component.

---

## Verification

### Manual Testing Checklist

1. [ ] Run migration on local Supabase
2. [ ] Set a test user as `is_internal = true` in database
3. [ ] Login as internal user - see organization selector in header
4. [ ] Create a new prospect organization
5. [ ] Run audit on new organization
6. [ ] Run one-time URL audit (no org)
7. [ ] Login as external user - only see their org
8. [ ] External user can audit their own org's website

### Commands

```bash
# Apply migration locally
supabase db reset

# Run linter
npm run lint

# Run unit tests
npm run test:unit

# Build
npm run build
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1.1 | Database migration |
| 2 | 2.1 | TypeScript types |
| 3 | 3.1 | Organization server actions |
| 4 | 4.1-4.2 | Organization selector components |
| 5 | 5.1 | Update header component |
| 6 | 6.1 | Audit target selector |
| 7 | 7.1-7.2 | Update site audit page |
| 8 | 8.1-8.2 | Update audit dashboard & API |
| 9 | 9.1 | Remove old project files |
| 10 | 10.1 | Update page speed (same pattern) |
| 11 | 11.1 | Update layouts |
