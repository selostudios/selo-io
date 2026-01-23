# Multi-Account Integrations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow multiple accounts per platform integration with customizable display names.

**Architecture:** Modify database schema to support multiple connections per platform (remove unique constraint, add account_name/display_name columns). Update OAuth callback to check for duplicate accounts rather than duplicate platforms. Update dashboard to show sub-sections when multiple accounts exist.

**Tech Stack:** Supabase (PostgreSQL), Next.js Server Actions, React components with Shadcn UI

---

## Phase 1: Database Schema Changes

### Task 1.1: Create Migration for Multi-Account Support

**Files:**
- Create: `supabase/migrations/20260122100000_multi_account_integrations.sql`

**Step 1: Write the migration**

```sql
-- Multi-account integrations support
-- Allows multiple connections per platform per organization

-- 1. Drop the unique constraint that limits one connection per platform
ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS platform_connections_organization_id_platform_type_key;

-- 2. Add new columns for account identification
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 3. Populate account_name from existing credentials for current connections
UPDATE platform_connections
SET account_name = credentials->>'organization_name'
WHERE account_name IS NULL
  AND credentials->>'organization_name' IS NOT NULL;

-- 4. Add unique constraint to prevent duplicate connections to same account
-- Uses (organization_id, platform_type, account_name) to allow multiple accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_connections_unique_account
  ON platform_connections(organization_id, platform_type, account_name)
  WHERE account_name IS NOT NULL;

-- 5. Add index for querying by organization and platform
CREATE INDEX IF NOT EXISTS idx_platform_connections_org_platform
  ON platform_connections(organization_id, platform_type);
```

**Step 2: Apply migration locally**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && supabase db reset`

Expected: Migration applies without errors

**Step 3: Verify schema change**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && supabase db dump --schema public | grep -A 15 "CREATE TABLE platform_connections"`

Expected: Table includes `account_name` and `display_name` columns, no unique constraint on just `(organization_id, platform_type)`

**Step 4: Commit**

```bash
git add supabase/migrations/20260122100000_multi_account_integrations.sql
git commit -m "feat: add multi-account support schema migration"
```

---

## Phase 2: OAuth Callback Updates

### Task 2.1: Update OAuth Callback to Support Multiple Accounts

**Files:**
- Modify: `app/api/auth/oauth/[provider]/callback/route.ts`

**Step 1: Update the duplicate check logic**

Change the existing check from "is this platform connected" to "is this specific account connected":

Find (around lines 156-171):
```typescript
// Check if already connected
const { data: existing } = await supabase
  .from('platform_connections')
  .select('id')
  .eq('organization_id', userRecord.organization_id)
  .eq('platform_type', platform)
  .single()

if (existing) {
  clearOAuthCookies(cookieStore)
  const message = getErrorMessage('already_connected', {
    orgId: selectedAccount.id,
    connectionId: existing.id,
  })
  return redirect(`/settings/integrations?error=${encodeURIComponent(message)}`)
}
```

Replace with:
```typescript
// Check if this specific account is already connected
const { data: existing } = await supabase
  .from('platform_connections')
  .select('id')
  .eq('organization_id', userRecord.organization_id)
  .eq('platform_type', platform)
  .eq('account_name', selectedAccount.name)
  .single()

if (existing) {
  clearOAuthCookies(cookieStore)
  const message = getErrorMessage('already_connected', {
    orgId: selectedAccount.id,
    connectionId: existing.id,
  })
  return redirect(`/settings/integrations?error=${encodeURIComponent(message)}`)
}
```

**Step 2: Update the insert to include account_name**

Find (around lines 173-188):
```typescript
const { error: insertError } = await supabase.from('platform_connections').insert({
  organization_id: userRecord.organization_id,
  platform_type: platform,
  credentials: {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    organization_id: selectedAccount.id,
    organization_name: selectedAccount.name,
    scopes: tokens.scopes || [],
  },
  status: 'active',
})
```

Replace with:
```typescript
const { error: insertError } = await supabase.from('platform_connections').insert({
  organization_id: userRecord.organization_id,
  platform_type: platform,
  account_name: selectedAccount.name,
  credentials: {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    organization_id: selectedAccount.id,
    organization_name: selectedAccount.name,
    scopes: tokens.scopes || [],
  },
  status: 'active',
})
```

**Step 3: Run lint and build**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && npm run lint && npm run build`

Expected: No errors

**Step 4: Commit**

```bash
git add app/api/auth/oauth/[provider]/callback/route.ts
git commit -m "feat: allow multiple accounts per platform in OAuth callback"
```

---

## Phase 3: Integrations Settings Page

### Task 3.1: Update Integrations Page to Show Multiple Connections

**Files:**
- Modify: `app/settings/integrations/page.tsx`

**Step 1: Update the page to group connections by platform**

Replace the entire file content:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OAuthToastHandler } from './oauth-toast-handler'
import { IntegrationsPageContent } from './integrations-page-content'

export default async function IntegrationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/login')
  }

  const { data: connections } = await supabase
    .from('platform_connections')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: true })

  const platforms = ['linkedin', 'hubspot', 'google_analytics'] as const

  // Group connections by platform type
  const connectionsByPlatform = platforms.reduce(
    (acc, platform) => {
      acc[platform] = (connections || []).filter((c) => c.platform_type === platform)
      return acc
    },
    {} as Record<string, typeof connections>
  )

  return (
    <>
      <OAuthToastHandler />
      <IntegrationsPageContent connectionsByPlatform={connectionsByPlatform} />
    </>
  )
}
```

**Step 2: Commit**

```bash
git add app/settings/integrations/page.tsx
git commit -m "refactor: group connections by platform in integrations page"
```

### Task 3.2: Create IntegrationsPageContent Component

**Files:**
- Create: `app/settings/integrations/integrations-page-content.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlatformConnectionGroup } from '@/components/settings/platform-connection-group'
import { AddIntegrationDialog } from '@/components/settings/add-integration-dialog'

type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

interface IntegrationsPageContentProps {
  connectionsByPlatform: Record<string, Connection[]>
}

const platformOrder = ['linkedin', 'hubspot', 'google_analytics'] as const

export function IntegrationsPageContent({ connectionsByPlatform }: IntegrationsPageContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Platform Integrations</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect your marketing platforms to track campaign performance
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>

      <div className="space-y-6">
        {platformOrder.map((platform) => (
          <PlatformConnectionGroup
            key={platform}
            platformType={platform}
            connections={connectionsByPlatform[platform] || []}
          />
        ))}
      </div>

      <AddIntegrationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/settings/integrations/integrations-page-content.tsx
git commit -m "feat: add IntegrationsPageContent with add integration button"
```

### Task 3.3: Create PlatformConnectionGroup Component

**Files:**
- Create: `components/settings/platform-connection-group.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { disconnectPlatform, updateConnectionDisplayName } from '@/app/settings/integrations/actions'
import { displayName } from '@/lib/utils'
import { EditDisplayNameDialog } from './edit-display-name-dialog'
import { DisconnectConfirmDialog } from './disconnect-confirm-dialog'

type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

const platformInfo: Record<string, { name: string; description: string }> = {
  hubspot: {
    name: 'HubSpot',
    description: 'Email campaigns, leads, deals, events',
  },
  google_analytics: {
    name: 'Google Analytics',
    description: 'Website traffic, conversions, UTM tracking',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Post impressions, engagement, followers',
  },
}

function formatLastSyncAt(lastSyncAt: string | null): string | null {
  if (!lastSyncAt) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(lastSyncAt))
}

function getConnectionLabel(connection: Connection): string {
  return connection.display_name || connection.account_name || 'Unknown Account'
}

interface PlatformConnectionGroupProps {
  platformType: string
  connections: Connection[]
}

export function PlatformConnectionGroup({ platformType, connections }: PlatformConnectionGroupProps) {
  const info = platformInfo[platformType] || { name: 'Unknown', description: '' }

  if (connections.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{info.name}</CardTitle>
              <CardDescription className="mt-1">{info.description}</CardDescription>
            </div>
            <Badge variant="warning">Not connected</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              window.location.href = `/api/auth/oauth/${platformType}`
            }}
          >
            Connect
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{info.name}</CardTitle>
            <CardDescription className="mt-1">{info.description}</CardDescription>
          </div>
          <Badge variant="success">{connections.length} connected</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {connections.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} />
        ))}
      </CardContent>
    </Card>
  )
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const [editOpen, setEditOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="font-medium">{getConnectionLabel(connection)}</p>
        {connection.last_sync_at && (
          <p className="text-muted-foreground text-xs">
            Last synced: {formatLastSyncAt(connection.last_sync_at)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">{displayName(connection.status)}</Badge>
        <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit display name</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setDisconnectOpen(true)}>
          <Trash2 className="h-4 w-4 text-destructive" />
          <span className="sr-only">Disconnect</span>
        </Button>
      </div>

      <EditDisplayNameDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        connectionId={connection.id}
        currentName={getConnectionLabel(connection)}
      />

      <DisconnectConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        connectionId={connection.id}
        accountName={getConnectionLabel(connection)}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/platform-connection-group.tsx
git commit -m "feat: add PlatformConnectionGroup component for multiple connections"
```

### Task 3.4: Create AddIntegrationDialog Component

**Files:**
- Create: `components/settings/add-integration-dialog.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface AddIntegrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const platforms = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'hubspot', label: 'HubSpot' },
  { value: 'google_analytics', label: 'Google Analytics' },
]

export function AddIntegrationDialog({ open, onOpenChange }: AddIntegrationDialogProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')

  function handleConnect() {
    if (selectedPlatform) {
      window.location.href = `/api/auth/oauth/${selectedPlatform}`
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Integration</DialogTitle>
          <DialogDescription>
            Connect a new marketing platform to track metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.value} value={platform.value}>
                    {platform.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={!selectedPlatform}>
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/add-integration-dialog.tsx
git commit -m "feat: add AddIntegrationDialog component"
```

### Task 3.5: Create EditDisplayNameDialog Component

**Files:**
- Create: `components/settings/edit-display-name-dialog.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateConnectionDisplayName } from '@/app/settings/integrations/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

interface EditDisplayNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  currentName: string
}

export function EditDisplayNameDialog({
  open,
  onOpenChange,
  connectionId,
  currentName,
}: EditDisplayNameDialogProps) {
  const [displayName, setDisplayName] = useState(currentName)
  const [isPending, setIsPending] = useState(false)

  async function handleSave() {
    setIsPending(true)
    const result = await updateConnectionDisplayName(connectionId, displayName)
    setIsPending(false)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('Display name updated')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Display Name</DialogTitle>
          <DialogDescription>
            Customize how this connection appears in your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Company Page, Founder"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !displayName.trim()}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/edit-display-name-dialog.tsx
git commit -m "feat: add EditDisplayNameDialog component"
```

### Task 3.6: Create DisconnectConfirmDialog Component

**Files:**
- Create: `components/settings/disconnect-confirm-dialog.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { disconnectPlatform } from '@/app/settings/integrations/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

interface DisconnectConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  accountName: string
}

export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  connectionId,
  accountName,
}: DisconnectConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false)

  async function handleDisconnect() {
    setIsPending(true)
    const result = await disconnectPlatform(connectionId)
    setIsPending(false)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('Integration disconnected')
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect {accountName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove all synced metrics for this account. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisconnect}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Disconnecting...' : 'Disconnect'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Step 2: Commit**

```bash
git add components/settings/disconnect-confirm-dialog.tsx
git commit -m "feat: add DisconnectConfirmDialog component"
```

### Task 3.7: Add Server Action for Updating Display Name

**Files:**
- Modify: `app/settings/integrations/actions.ts`

**Step 1: Add the updateConnectionDisplayName action**

Add after the `disconnectPlatform` function:

```typescript
export async function updateConnectionDisplayName(connectionId: string, displayName: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageIntegrations(userRecord.role)) {
    return { error: 'Only admins can update integrations' }
  }

  const { error } = await supabase
    .from('platform_connections')
    .update({ display_name: displayName.trim() || null })
    .eq('id', connectionId)
    .eq('organization_id', userRecord.organization_id)

  if (error) {
    console.error('[Update Display Name Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to update display name' }
  }

  revalidatePath('/settings/integrations')
  return { success: true }
}
```

**Step 2: Run lint**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/settings/integrations/actions.ts
git commit -m "feat: add updateConnectionDisplayName server action"
```

### Task 3.8: Delete Old PlatformConnectionCard Component

**Files:**
- Delete: `components/settings/platform-connection-card.tsx`

**Step 1: Remove the file**

```bash
rm components/settings/platform-connection-card.tsx
```

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor: remove old PlatformConnectionCard component"
```

---

## Phase 4: Dashboard Updates

### Task 4.1: Update Dashboard Page to Pass Connections Array

**Files:**
- Modify: `app/dashboard/page.tsx`

**Step 1: Read the current file to find the data fetching section**

Find the section that fetches platform connections and update it to return all connections, not just one per platform.

The current code likely does something like:
```typescript
const connectionsMap = new Map(connections?.map((c) => [c.platform_type, c]) || [])
```

Update to pass the full connections array:

```typescript
// Group connections by platform, keeping all connections
const connectionsByPlatform = {
  linkedin: (connections || []).filter((c) => c.platform_type === 'linkedin'),
  google_analytics: (connections || []).filter((c) => c.platform_type === 'google_analytics'),
  hubspot: (connections || []).filter((c) => c.platform_type === 'hubspot'),
}
```

Then update the IntegrationsPanel props accordingly.

**Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: pass multiple connections to IntegrationsPanel"
```

### Task 4.2: Update IntegrationsPanel Props

**Files:**
- Modify: `components/dashboard/integrations-panel.tsx`

**Step 1: Update the props interface and component**

Change from:
```typescript
interface IntegrationsPanelProps {
  linkedIn: { isConnected: boolean; lastSyncAt: string | null }
  googleAnalytics: { isConnected: boolean; lastSyncAt: string | null }
  hubspot: { isConnected: boolean; lastSyncAt: string | null }
  connectionCount: number
  totalPlatforms: number
}
```

To:
```typescript
type Connection = {
  id: string
  platform_type: string
  account_name: string | null
  display_name: string | null
  status: string
  last_sync_at: string | null
}

interface IntegrationsPanelProps {
  linkedInConnections: Connection[]
  googleAnalyticsConnections: Connection[]
  hubspotConnections: Connection[]
}
```

Update the component to:
- Calculate `connectionCount` from the sum of all connections
- Pass connections array to each platform section
- Update sync logic to sync all connections

**Step 2: Commit**

```bash
git add components/dashboard/integrations-panel.tsx
git commit -m "feat: update IntegrationsPanel to support multiple connections"
```

### Task 4.3: Update LinkedInSection to Support Multiple Connections

**Files:**
- Modify: `components/dashboard/linkedin-section.tsx`

**Step 1: Update props and rendering**

Change from:
```typescript
interface LinkedInSectionProps {
  isConnected: boolean
  period: Period
}
```

To:
```typescript
type Connection = {
  id: string
  account_name: string | null
  display_name: string | null
}

interface LinkedInSectionProps {
  connections: Connection[]
  period: Period
}
```

Update the component to:
- Show "not connected" state when `connections.length === 0`
- When single connection: render current UI (no account header)
- When multiple connections: render a sub-section for each with account name header
- Each sub-section fetches its own metrics using `connectionId`

**Step 2: Commit**

```bash
git add components/dashboard/linkedin-section.tsx
git commit -m "feat: update LinkedInSection for multiple accounts"
```

### Task 4.4: Update GoogleAnalyticsSection for Multiple Connections

**Files:**
- Modify: `components/dashboard/google-analytics-section.tsx`

Follow the same pattern as Task 4.3.

**Step 1: Apply same changes as LinkedInSection**

**Step 2: Commit**

```bash
git add components/dashboard/google-analytics-section.tsx
git commit -m "feat: update GoogleAnalyticsSection for multiple accounts"
```

### Task 4.5: Update HubSpotSection for Multiple Connections

**Files:**
- Modify: `components/dashboard/hubspot-section.tsx`

Follow the same pattern as Task 4.3.

**Step 1: Apply same changes as LinkedInSection**

**Step 2: Commit**

```bash
git add components/dashboard/hubspot-section.tsx
git commit -m "feat: update HubSpotSection for multiple accounts"
```

---

## Phase 5: Metrics Actions Updates

### Task 5.1: Update LinkedIn Actions for Connection-Specific Metrics

**Files:**
- Modify: `lib/platforms/linkedin/actions.ts`

**Step 1: Update getLinkedInMetrics to accept connectionId**

Change signature from:
```typescript
export async function getLinkedInMetrics(period: Period)
```

To:
```typescript
export async function getLinkedInMetrics(period: Period, connectionId?: string)
```

Update the query to filter by `connectionId` if provided.

**Step 2: Update syncLinkedInMetrics similarly**

**Step 3: Commit**

```bash
git add lib/platforms/linkedin/actions.ts
git commit -m "feat: add connectionId parameter to LinkedIn metrics actions"
```

### Task 5.2: Update Google Analytics Actions

**Files:**
- Modify: `lib/platforms/google-analytics/actions.ts`

Apply same changes as Task 5.1.

**Step 1: Add connectionId parameter**

**Step 2: Commit**

```bash
git add lib/platforms/google-analytics/actions.ts
git commit -m "feat: add connectionId parameter to GA metrics actions"
```

### Task 5.3: Update HubSpot Actions

**Files:**
- Modify: `lib/platforms/hubspot/actions.ts`

Apply same changes as Task 5.1.

**Step 1: Add connectionId parameter**

**Step 2: Commit**

```bash
git add lib/platforms/hubspot/actions.ts
git commit -m "feat: add connectionId parameter to HubSpot metrics actions"
```

---

## Phase 6: Testing and Verification

### Task 6.1: Run Full Test Suite

**Step 1: Run lint**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && npm run lint`

Expected: No errors

**Step 2: Run unit tests**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && npm run test:unit`

Expected: All tests pass

**Step 3: Run build**

Run: `cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/multi-account-integrations && npm run build`

Expected: Build succeeds

### Task 6.2: Manual Testing Checklist

Test the following scenarios:

1. **Add first integration**: Click "+", select LinkedIn, complete OAuth
2. **Add second account to same platform**: Click "+", select LinkedIn again, OAuth with different account
3. **View integrations page**: Should show both LinkedIn accounts under LinkedIn group
4. **Edit display name**: Click edit on a connection, change name, verify it saves
5. **Dashboard view (single account)**: Should show metrics without account header
6. **Dashboard view (multiple accounts)**: Should show sub-sections with account names
7. **Disconnect one account**: Verify only that account is removed
8. **Reconnect same account**: Should show "already connected" error

---

## File Summary

| File | Action |
|------|--------|
| `supabase/migrations/20260122100000_multi_account_integrations.sql` | Create |
| `app/api/auth/oauth/[provider]/callback/route.ts` | Modify |
| `app/settings/integrations/page.tsx` | Modify |
| `app/settings/integrations/integrations-page-content.tsx` | Create |
| `app/settings/integrations/actions.ts` | Modify |
| `components/settings/platform-connection-group.tsx` | Create |
| `components/settings/add-integration-dialog.tsx` | Create |
| `components/settings/edit-display-name-dialog.tsx` | Create |
| `components/settings/disconnect-confirm-dialog.tsx` | Create |
| `components/settings/platform-connection-card.tsx` | Delete |
| `app/dashboard/page.tsx` | Modify |
| `components/dashboard/integrations-panel.tsx` | Modify |
| `components/dashboard/linkedin-section.tsx` | Modify |
| `components/dashboard/google-analytics-section.tsx` | Modify |
| `components/dashboard/hubspot-section.tsx` | Modify |
| `lib/platforms/linkedin/actions.ts` | Modify |
| `lib/platforms/google-analytics/actions.ts` | Modify |
| `lib/platforms/hubspot/actions.ts` | Modify |
