# App Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Selo-level settings area with three tabs — Team (internal employee management), Integrations (app-level API keys + email config), and System (health + usage dashboard).

**Architecture:** New parent sidebar section visible to internal users. Three new DB tables (`internal_employees`, `app_settings`, `usage_logs`). Reuses existing invite flow with a new `type` column for internal invites. Existing `crypto.ts` for credential encryption. Dual-write keeps `users.is_internal` in sync. Runtime credential resolution falls back to env vars.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), React Server Components, Shadcn UI, React Email, Resend, AES-256-GCM encryption via `lib/utils/crypto.ts`.

**Design doc:** `docs/plans/2026-03-12-app-settings-design.md`

---

## Phase 1: Database + Navigation Foundation

### Task 1: Migration — Create tables, RLS, backfill

**Files:**

- Create: `supabase/migrations/20260312000000_app_settings_tables.sql`

**Step 1: Write the migration**

```sql
-- =============================================================================
-- App Settings Tables
-- =============================================================================

-- Internal employees — source of truth for who has internal access
CREATE TABLE internal_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_internal_employees_public_user
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

ALTER TABLE internal_employees ENABLE ROW LEVEL SECURITY;

-- SELECT: internal users can view all rows
CREATE POLICY "Internal users can view employees"
  ON internal_employees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid()) AND is_internal = true
    )
  );

-- INSERT/UPDATE/DELETE: internal admins only
CREATE POLICY "Internal admins can manage employees"
  ON internal_employees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

CREATE POLICY "Internal admins can update employees"
  ON internal_employees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

CREATE POLICY "Internal admins can delete employees"
  ON internal_employees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON internal_employees TO authenticated;

-- App settings — encrypted app-level credentials
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  credentials JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view app settings"
  ON app_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid()) AND is_internal = true
    )
  );

CREATE POLICY "Internal admins can manage app settings"
  ON app_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO authenticated;

-- SECURITY DEFINER function for service-level reads (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_app_credential(setting_key TEXT)
RETURNS JSONB
LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT credentials FROM public.app_settings WHERE key = setting_key;
$$;

-- Usage logs — tracks billable API calls
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost NUMERIC(10,6),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can view usage logs"
  ON usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid()) AND is_internal = true
    )
  );

-- Service-level code inserts via service client (bypasses RLS)
-- No INSERT policy needed for authenticated — only service client writes

GRANT SELECT ON usage_logs TO authenticated;

CREATE INDEX idx_usage_logs_service_created ON usage_logs (service, created_at DESC);
CREATE INDEX idx_usage_logs_org ON usage_logs (organization_id, created_at DESC);

-- Add type column to invites for internal invites
ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'org_invite';

-- Make organization_id nullable on invites (internal invites have no org)
ALTER TABLE invites
  ALTER COLUMN organization_id DROP NOT NULL;

-- Backfill internal_employees from existing is_internal flags
INSERT INTO internal_employees (user_id)
SELECT id FROM users WHERE is_internal = true
ON CONFLICT (user_id) DO NOTHING;
```

**Step 2: Apply migration locally**

Run: `supabase db reset`
Expected: Clean reset with migration applied, no errors.

**Step 3: Verify tables exist**

Run: `supabase db push` (to remote if ready, or just verify local)
Expected: Tables `internal_employees`, `app_settings`, `usage_logs` exist with RLS enabled.

**Step 4: Commit**

```bash
git add supabase/migrations/20260312000000_app_settings_tables.sql
git commit -m "feat: add internal_employees, app_settings, usage_logs tables"
```

---

### Task 2: Navigation — Add App Settings to sidebar

**Files:**

- Modify: `components/navigation/parent-sidebar.tsx`
- Modify: `components/navigation/child-sidebar.tsx`
- Modify: `components/navigation/navigation-shell.tsx`

**Step 1: Add App Settings section to parent sidebar**

In `components/navigation/parent-sidebar.tsx`, add to the `sections` array (between `organizations` and `support`):

```typescript
{ id: 'app-settings' as const, name: 'App Settings', icon: Settings2, internalOnly: true },
```

Import `Settings2` from `lucide-react`. Add `'app-settings'` to the `ParentSection` type.

**Step 2: Add app-settings navigation to child sidebar**

In `components/navigation/child-sidebar.tsx`, add:

```typescript
import { Users, Plug, Activity } from 'lucide-react'

const appSettingsNavigation: NavigationGroup[] = [
  {
    items: [
      { name: 'Team', href: '/app-settings/team', icon: Users },
      { name: 'Integrations', href: '/app-settings/integrations', icon: Plug },
      { name: 'System', href: '/app-settings/system', icon: Activity },
    ],
  },
]
```

Add to `navigationConfig`:

```typescript
'app-settings': appSettingsNavigation,
```

**Step 3: Update navigation shell**

In `components/navigation/navigation-shell.tsx`:

- Add `'app-settings'` to `sectionDefaultRoutes`:
  ```typescript
  'app-settings': '/app-settings/team',
  ```
- Add `/app-settings/*` routes to the section derivation logic so the correct parent section is highlighted.
- Add `/app-settings/*` to the list of routes that preserve `?org=` if applicable (likely not needed since app settings are org-agnostic, but check).

**Step 4: Verify navigation renders**

Run: `npm run dev`

- Log in as an internal user
- Verify "App Settings" appears in parent sidebar between Organizations and Support
- Verify clicking it shows Team, Integrations, System in child sidebar
- Verify non-internal users do NOT see the section

**Step 5: Commit**

```bash
git add components/navigation/parent-sidebar.tsx components/navigation/child-sidebar.tsx components/navigation/navigation-shell.tsx
git commit -m "feat: add App Settings section to navigation sidebar"
```

---

### Task 3: Layout + route guard for app-settings

**Files:**

- Create: `app/(authenticated)/app-settings/layout.tsx`

**Step 1: Create the layout**

```typescript
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'

export default async function AppSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord || !isInternalUser(userRecord)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
```

**Step 2: Create placeholder pages**

Create three placeholder pages so the routes resolve:

`app/(authenticated)/app-settings/team/page.tsx`:

```typescript
export default function AppSettingsTeamPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Internal Team</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div>
}
```

`app/(authenticated)/app-settings/integrations/page.tsx`:

```typescript
export default function AppSettingsIntegrationsPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">App Integrations</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div>
}
```

`app/(authenticated)/app-settings/system/page.tsx`:

```typescript
export default function AppSettingsSystemPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">System</h1><p className="text-muted-foreground mt-2">Coming soon.</p></div>
}
```

**Step 3: Verify guard works**

Run: `npm run dev`

- Internal user can access `/app-settings/team` — sees placeholder
- Non-internal user navigating to `/app-settings/team` is redirected to `/dashboard`

**Step 4: Commit**

```bash
git add "app/(authenticated)/app-settings/"
git commit -m "feat: add app-settings layout with internal user guard and placeholder pages"
```

---

## Phase 2: Integrations Tab

### Task 4: Credential resolution helper

**Files:**

- Create: `lib/app-settings/credentials.ts`
- Create: `tests/unit/lib/app-settings/credentials.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Mock crypto
vi.mock('@/lib/utils/crypto', () => ({
  decryptCredentials: vi.fn(),
}))

import { getAppCredential, ENV_VAR_MAP } from '@/lib/app-settings/credentials'
import { createServiceClient } from '@/lib/supabase/server'
import { decryptCredentials } from '@/lib/utils/crypto'

describe('getAppCredential', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns decrypted value from app_settings when row exists', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: { encrypted: 'encrypted-data' }, error: null }),
    }
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as any)
    vi.mocked(decryptCredentials).mockReturnValue({ api_key: 'sk-ant-real-key' })

    const result = await getAppCredential('anthropic')
    expect(result).toBe('sk-ant-real-key')
  })

  it('falls back to env var when no app_settings row exists', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as any)
    process.env.ANTHROPIC_API_KEY = 'env-key'

    const result = await getAppCredential('anthropic')
    expect(result).toBe('env-key')

    delete process.env.ANTHROPIC_API_KEY
  })

  it('returns null when neither app_settings nor env var exists', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(createServiceClient).mockResolvedValue(mockSupabase as any)
    delete process.env.ANTHROPIC_API_KEY

    const result = await getAppCredential('anthropic')
    expect(result).toBeNull()
  })

  it('maps correct env vars for each key', () => {
    expect(ENV_VAR_MAP.anthropic).toBe('ANTHROPIC_API_KEY')
    expect(ENV_VAR_MAP.resend).toBe('RESEND_API_KEY')
    expect(ENV_VAR_MAP.pagespeed).toBe('PAGESPEED_API_KEY')
    expect(ENV_VAR_MAP.cron_secret).toBe('CRON_SECRET')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/lib/app-settings/credentials.test.ts --run`
Expected: FAIL — module not found

**Step 3: Implement the credential helper**

```typescript
import { createServiceClient } from '@/lib/supabase/server'
import { decryptCredentials } from '@/lib/utils/crypto'

export const ENV_VAR_MAP: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  resend: 'RESEND_API_KEY',
  pagespeed: 'PAGESPEED_API_KEY',
  cron_secret: 'CRON_SECRET',
}

/** Credential value key within the decrypted JSONB per setting type */
const CREDENTIAL_FIELD: Record<string, string> = {
  anthropic: 'api_key',
  resend: 'api_key',
  pagespeed: 'api_key',
  cron_secret: 'secret',
}

/**
 * Resolve an app-level credential.
 * Checks app_settings table first (via SECURITY DEFINER RPC), falls back to env var.
 */
export async function getAppCredential(key: string): Promise<string | null> {
  try {
    const supabase = await createServiceClient()
    const { data } = await supabase.rpc('get_app_credential', { setting_key: key })

    if (data) {
      const decrypted = decryptCredentials<Record<string, string>>(data)
      const field = CREDENTIAL_FIELD[key] ?? 'api_key'
      return decrypted[field] ?? null
    }
  } catch (error) {
    console.error('[App Settings Error]', {
      type: 'credential_resolution',
      key,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Fallback to env var
  const envVar = ENV_VAR_MAP[key]
  return envVar ? (process.env[envVar] ?? null) : null
}

/**
 * Mask a credential string for display — shows last 6 characters.
 * Returns null if the input is empty or too short.
 */
export function maskCredential(value: string): string | null {
  if (!value || value.length < 6) return null
  const visible = value.slice(-6)
  return `${'•'.repeat(Math.min(value.length - 6, 20))}${visible}`
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/app-settings/credentials.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/app-settings/credentials.ts tests/unit/lib/app-settings/credentials.test.ts
git commit -m "feat: add credential resolution helper with env fallback"
```

---

### Task 5: Integrations tab — server actions

**Files:**

- Create: `app/(authenticated)/app-settings/integrations/actions.ts`

**Step 1: Implement server actions**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { encryptCredentials, decryptCredentials } from '@/lib/utils/crypto'
import { isInternalUser } from '@/lib/permissions'
import { maskCredential } from '@/lib/app-settings/credentials'

interface AppSettingDisplay {
  key: string
  configured: boolean
  maskedValue: string | null
  updatedAt: string | null
  updatedByEmail: string | null
}

const CREDENTIAL_FIELD: Record<string, string> = {
  anthropic: 'api_key',
  resend: 'api_key',
  pagespeed: 'api_key',
  cron_secret: 'secret',
  email_config: '__plaintext__',
}

async function requireInternalAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return { error: 'Not authenticated' as const, user: null, supabase: null, userRecord: null }

  const { data: rawUser } = await supabase
    .from('users')
    .select('id, is_internal, team_members(organization_id, role)')
    .eq('id', user.id)
    .single()

  if (!rawUser)
    return { error: 'User not found' as const, user: null, supabase: null, userRecord: null }

  const membership = (rawUser.team_members as { organization_id: string; role: string }[])?.[0]
  const userRecord = {
    id: rawUser.id,
    organization_id: membership?.organization_id ?? null,
    role: membership?.role ?? 'client_viewer',
    is_internal: rawUser.is_internal,
  }

  if (!isInternalUser(userRecord)) {
    return { error: 'Not authorized' as const, user: null, supabase: null, userRecord: null }
  }

  return { error: null, user, supabase, userRecord }
}

function requireAdmin(role: string) {
  return role === 'admin'
}

export async function getAppSettings(): Promise<AppSettingDisplay[] | { error: string }> {
  const { error, supabase } = await requireInternalAdmin()
  if (error) return { error }

  const { data: settings, error: fetchError } = await supabase!
    .from('app_settings')
    .select('key, credentials, updated_at, updated_by')
    .order('key')

  if (fetchError) {
    console.error('[App Settings Error]', {
      type: 'fetch_settings',
      timestamp: new Date().toISOString(),
      error: fetchError.message,
    })
    return { error: 'Failed to load settings' }
  }

  // Fetch updater emails in parallel
  const updaterIds = [
    ...new Set((settings ?? []).filter((s) => s.updated_by).map((s) => s.updated_by)),
  ]
  let emailMap: Record<string, string> = {}
  if (updaterIds.length > 0) {
    const serviceClient = await createServiceClient()
    for (const uid of updaterIds) {
      const { data: authUser } = await serviceClient.auth.admin.getUserById(uid)
      if (authUser?.user?.email) {
        emailMap[uid] = authUser.user.email
      }
    }
  }

  const allKeys = ['anthropic', 'resend', 'pagespeed', 'cron_secret', 'email_config']
  const settingsMap = new Map((settings ?? []).map((s) => [s.key, s]))

  return allKeys.map((key) => {
    const setting = settingsMap.get(key)
    if (!setting) {
      return { key, configured: false, maskedValue: null, updatedAt: null, updatedByEmail: null }
    }

    let maskedValue: string | null = null
    try {
      if (key === 'email_config') {
        // Email config is not encrypted — show from_email directly
        const config = setting.credentials as { from_name?: string; from_email?: string }
        maskedValue = config.from_email ?? null
      } else {
        const decrypted = decryptCredentials<Record<string, string>>(setting.credentials)
        const field = CREDENTIAL_FIELD[key] ?? 'api_key'
        maskedValue = maskCredential(decrypted[field] ?? '')
      }
    } catch {
      maskedValue = '(decrypt error)'
    }

    return {
      key,
      configured: true,
      maskedValue,
      updatedAt: setting.updated_at,
      updatedByEmail: setting.updated_by ? (emailMap[setting.updated_by] ?? null) : null,
    }
  })
}

export async function updateAppSetting(key: string, value: string) {
  const { error, supabase, user, userRecord } = await requireInternalAdmin()
  if (error) return { error }
  if (!requireAdmin(userRecord!.role)) return { error: 'Admin access required' }

  const field = CREDENTIAL_FIELD[key]
  if (!field) return { error: 'Unknown setting key' }

  let credentials: unknown
  if (key === 'email_config') {
    // Email config stored as plain JSONB (not sensitive)
    try {
      credentials = JSON.parse(value)
    } catch {
      return { error: 'Invalid JSON for email config' }
    }
  } else {
    // API keys encrypted
    credentials = encryptCredentials({ [field]: value })
  }

  const { error: upsertError } = await supabase!.from('app_settings').upsert(
    {
      key,
      credentials,
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (upsertError) {
    console.error('[App Settings Error]', {
      type: 'update_setting',
      key,
      timestamp: new Date().toISOString(),
      error: upsertError.message,
    })
    return { error: 'Failed to update setting' }
  }

  revalidatePath('/app-settings/integrations')
  return { success: true }
}

export async function removeAppSetting(key: string) {
  const { error, supabase, userRecord } = await requireInternalAdmin()
  if (error) return { error }
  if (!requireAdmin(userRecord!.role)) return { error: 'Admin access required' }

  const { error: deleteError } = await supabase!.from('app_settings').delete().eq('key', key)

  if (deleteError) {
    console.error('[App Settings Error]', {
      type: 'remove_setting',
      key,
      timestamp: new Date().toISOString(),
      error: deleteError.message,
    })
    return { error: 'Failed to remove setting' }
  }

  revalidatePath('/app-settings/integrations')
  return { success: true }
}

export async function testAppConnection(
  key: string
): Promise<{ success: boolean; message: string }> {
  const { error, supabase, userRecord } = await requireInternalAdmin()
  if (error) return { success: false, message: error }
  if (!requireAdmin(userRecord!.role)) return { success: false, message: 'Admin access required' }

  // Get the credential (from DB or env fallback)
  const { getAppCredential } = await import('@/lib/app-settings/credentials')
  const credential = await getAppCredential(key)

  if (!credential) {
    return { success: false, message: 'No credential configured' }
  }

  try {
    switch (key) {
      case 'anthropic': {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': credential,
            'anthropic-version': '2023-06-01',
          },
        })
        if (!res.ok) {
          const body = await res.text()
          return { success: false, message: `API returned ${res.status}: ${body.slice(0, 200)}` }
        }
        return { success: true, message: 'Connected successfully' }
      }

      case 'resend': {
        const res = await fetch('https://api.resend.com/api-keys', {
          headers: { Authorization: `Bearer ${credential}` },
        })
        if (!res.ok) {
          return { success: false, message: `API returned ${res.status}` }
        }
        return { success: true, message: 'Connected successfully' }
      }

      case 'pagespeed': {
        const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://google.com&key=${credential}&category=performance&strategy=mobile`
        const res = await fetch(url)
        if (!res.ok) {
          return { success: false, message: `API returned ${res.status}` }
        }
        return { success: true, message: 'Connected successfully' }
      }

      default:
        return { success: false, message: 'Test not available for this service' }
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

export async function updateEmailConfig(fromName: string, fromEmail: string) {
  return updateAppSetting(
    'email_config',
    JSON.stringify({ from_name: fromName, from_email: fromEmail })
  )
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add "app/(authenticated)/app-settings/integrations/actions.ts"
git commit -m "feat: add app settings integrations server actions"
```

---

### Task 6: Integrations tab — UI page

**Files:**

- Modify: `app/(authenticated)/app-settings/integrations/page.tsx` (replace placeholder)
- Create: `app/(authenticated)/app-settings/integrations/client.tsx`

**Step 1: Create the server page**

Replace placeholder `app/(authenticated)/app-settings/integrations/page.tsx`:

```typescript
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { redirect } from 'next/navigation'
import { isInternalUser } from '@/lib/permissions'
import { getAppSettings } from './actions'
import { IntegrationsClient } from './client'

export default async function AppSettingsIntegrationsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userRecord = await getUserRecord(user.id)
  if (!userRecord || !isInternalUser(userRecord)) redirect('/dashboard')

  const settings = await getAppSettings()
  if ('error' in settings) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load settings: {settings.error}</p>
      </div>
    )
  }

  const isAdmin = userRecord.role === 'admin'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">App Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys and credentials for platform services.
        </p>
      </div>
      <IntegrationsClient settings={settings} isAdmin={isAdmin} />
    </div>
  )
}
```

**Step 2: Create the client component**

Create `app/(authenticated)/app-settings/integrations/client.tsx`. This component renders:

- A card per API key provider (Anthropic, Resend, PageSpeed, Cron Secret) with status badge, masked value, last updated, and action buttons (Update Key, Test Connection, Remove)
- An email configuration section below with from name and from email inputs
- Update key dialog (Shadcn Dialog with input + save button)
- Remove confirmation dialog (Shadcn AlertDialog)
- Toast notifications for test connection results

Use the following Shadcn components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Button`, `Input`, `Label`, `Badge`, `Dialog`, `AlertDialog`, and `toast` from `sonner`.

Provider metadata:

```typescript
const PROVIDERS = [
  {
    key: 'anthropic',
    name: 'Anthropic',
    description: 'Claude AI API for audits and reports',
    icon: Bot,
    placeholder: 'sk-ant-...',
  },
  {
    key: 'resend',
    name: 'Resend',
    description: 'Transactional email delivery',
    icon: Mail,
    placeholder: 're_...',
  },
  {
    key: 'pagespeed',
    name: 'PageSpeed Insights',
    description: 'Google PageSpeed API for performance audits',
    icon: Gauge,
    placeholder: 'AIza...',
  },
  {
    key: 'cron_secret',
    name: 'Cron Secret',
    description: 'Bearer token for cron job authentication',
    icon: KeyRound,
    testable: false,
    placeholder: '',
  },
] as const
```

Each card layout:

```
┌────────────────────────────────────────────────────────┐
│ [Icon]  Provider Name                    [Configured]  │
│         Provider description                           │
│                                                        │
│  ••••••••••abc123                                      │
│  Updated 2 hours ago by owain@selo.io                  │
│                                                        │
│  [Test Connection]  [Update Key]  [Remove]             │
└────────────────────────────────────────────────────────┘
```

Email config section:

```
┌────────────────────────────────────────────────────────┐
│ Email Configuration                                    │
│                                                        │
│ From Name:  [Selo                    ]                 │
│ From Email: [hello@selo.io           ]                 │
│                                                        │
│                                    [Save Changes]      │
└────────────────────────────────────────────────────────┘
```

**Step 3: Verify page renders**

Run: `npm run dev`

- Navigate to `/app-settings/integrations` as internal user
- Cards should render with "Not configured" status for all providers
- Non-admin internal user should see disabled buttons

**Step 4: Commit**

```bash
git add "app/(authenticated)/app-settings/integrations/"
git commit -m "feat: add integrations tab with API key management UI"
```

---

## Phase 3: Team Tab

### Task 7: Team tab — server actions

**Files:**

- Create: `app/(authenticated)/app-settings/team/actions.ts`

**Step 1: Implement server actions**

The file needs these actions:

- `getInternalEmployees()` — queries `internal_employees` joined with `users` (for name) and fetches `last_sign_in_at` from auth admin API. Returns array of `{ id, userId, email, firstName, lastName, lastSignIn, createdAt }`.

- `inviteInternalEmployee(email: string)` — creates invite with `type: 'internal_invite'`, `organization_id: null`, `role: null`. Sends email using new internal invite template via Resend. Uses service client to create invite (since no org context for RLS). Revalidates path.

- `removeInternalEmployee(userId: string)` — confirmation already handled client-side. Checks user is not removing themselves. Deletes from `internal_employees`, sets `users.is_internal = false`, deletes auth user (cascade). Uses service client for auth admin operations. Revalidates path.

Auth pattern: reuse the `requireInternalAdmin()` helper (extract to shared file `lib/app-settings/auth.ts` or inline). All mutations require admin role.

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

**Step 3: Commit**

```bash
git add "app/(authenticated)/app-settings/team/actions.ts"
git commit -m "feat: add team management server actions for internal employees"
```

---

### Task 8: Internal invite email template

**Files:**

- Create: `emails/internal-invite-email.tsx`

**Step 1: Create the template**

Follow the same pattern as `emails/invite-email.tsx` but with internal branding:

- Subject: "You've been invited to join the Selo team"
- Header: Selo logo (or text "Selo")
- Body: "You've been invited to join Selo as an internal team member. You'll have access to all organizations and internal tools."
- CTA button: "Accept Invitation" linking to `{siteUrl}/accept-invite/{inviteId}`
- Fallback link text below button
- Footer: "This invitation expires in 7 days."

Use the same React Email components (`Html`, `Head`, `Body`, `Container`, `Section`, `Text`, `Button`, `Link`, `Hr`) as the existing invite template.

**Step 2: Preview the email**

Run: `npm run email`

- Open React Email preview server
- Verify `internal-invite-email` appears and renders correctly

**Step 3: Commit**

```bash
git add emails/internal-invite-email.tsx
git commit -m "feat: add internal employee invite email template"
```

---

### Task 9: Team tab — UI page

**Files:**

- Modify: `app/(authenticated)/app-settings/team/page.tsx` (replace placeholder)
- Create: `app/(authenticated)/app-settings/team/client.tsx`

**Step 1: Create the server page**

Replace placeholder with RSC that fetches internal employees and passes to client component. Follow same pattern as Task 6 server page — auth check, fetch data, pass `isAdmin` flag.

**Step 2: Create the client component**

`app/(authenticated)/app-settings/team/client.tsx`:

- Table with columns: Name, Email, Last Sign In
- "Invite Employee" button (admin only) → Dialog with email input
- "Remove" button per row (admin only) → AlertDialog with warning
  - If user has no `team_members` record, show extra warning: "This user has no organization membership and will be locked out."
- Cannot remove yourself (button disabled or hidden for current user row)
- Uses `sonner` toast for success/error feedback

**Step 3: Verify page renders**

Run: `npm run dev`

- Navigate to `/app-settings/team` as internal admin
- Table should show current internal employees (backfilled from migration)
- Invite and Remove buttons should be visible

**Step 4: Commit**

```bash
git add "app/(authenticated)/app-settings/team/"
git commit -m "feat: add team tab with internal employee management UI"
```

---

### Task 10: Accept invite — branch on invite type

**Files:**

- Modify: `app/accept-invite/[id]/page.tsx`
- Modify: `app/accept-invite/[id]/actions.ts`
- Modify: `app/auth/callback/route.ts`

**Step 1: Update accept-invite page**

In `app/accept-invite/[id]/page.tsx`:

- After fetching invite, check `invite.type`
- If `'internal_invite'`:
  - Show "You've been invited to join the Selo team" instead of org name
  - Don't show role badge (internal invites have no role)
  - Don't show organization info

**Step 2: Update accept-invite action**

In `app/accept-invite/[id]/actions.ts`:

- After the existing email validation, branch on `invite.type`:
  - If `'internal_invite'`:
    - Insert into `internal_employees` with `added_by = invite.invited_by`
    - Set `users.is_internal = true` via upsert
    - Skip `team_members` insert (no org to join)
    - Mark invite as accepted
    - Redirect to `/dashboard`
  - If `'org_invite'`: existing flow unchanged

**Step 3: Update auth callback**

In `app/auth/callback/route.ts`:

- When checking for pending invites, also check for `type = 'internal_invite'`
- If an internal invite is found and auto-accepted:
  - Insert into `internal_employees`
  - Set `users.is_internal = true`
  - Mark invite accepted
  - Skip `team_members` insert

**Step 4: Test the full flow**

Run: `npm run dev`

1. Go to `/app-settings/team`, invite an email address
2. Check email preview (Mailpit if local)
3. Open the accept link
4. Verify the page shows "Selo team" messaging
5. Accept → verify user appears in internal employees table

**Step 5: Commit**

```bash
git add "app/accept-invite/[id]/" app/auth/callback/route.ts
git commit -m "feat: support internal invite type in accept-invite flow"
```

---

## Phase 4: System Tab

### Task 11: Usage logging helper

**Files:**

- Create: `lib/app-settings/usage.ts`
- Create: `tests/unit/lib/app-settings/usage.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { logUsage } from '@/lib/app-settings/usage'
import { createServiceClient } from '@/lib/supabase/server'

describe('logUsage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a usage log record via service client', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    vi.mocked(createServiceClient).mockResolvedValue({ from: mockFrom } as any)

    await logUsage('anthropic', 'ai_analysis', {
      organizationId: 'org-123',
      tokensInput: 1000,
      tokensOutput: 500,
      cost: 0.0045,
      metadata: { model: 'claude-sonnet-4-5-20250514' },
    })

    expect(mockFrom).toHaveBeenCalledWith('usage_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      service: 'anthropic',
      event_type: 'ai_analysis',
      organization_id: 'org-123',
      tokens_input: 1000,
      tokens_output: 500,
      cost: 0.0045,
      metadata: { model: 'claude-sonnet-4-5-20250514' },
    })
  })

  it('does not throw on insert failure (fire-and-forget)', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'DB down' } })
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
    vi.mocked(createServiceClient).mockResolvedValue({ from: mockFrom } as any)

    // Should not throw
    await logUsage('resend', 'email_sent', {})
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/lib/app-settings/usage.test.ts --run`
Expected: FAIL — module not found

**Step 3: Implement usage logger**

```typescript
import { createServiceClient } from '@/lib/supabase/server'

interface UsageOptions {
  organizationId?: string | null
  tokensInput?: number
  tokensOutput?: number
  cost?: number
  metadata?: Record<string, unknown>
}

/**
 * Log a billable API call. Fire-and-forget — never throws.
 * Uses service client to bypass RLS.
 */
export async function logUsage(
  service: string,
  eventType: string,
  opts: UsageOptions = {}
): Promise<void> {
  try {
    const supabase = await createServiceClient()
    const { error } = await supabase.from('usage_logs').insert({
      service,
      event_type: eventType,
      organization_id: opts.organizationId ?? null,
      tokens_input: opts.tokensInput ?? null,
      tokens_output: opts.tokensOutput ?? null,
      cost: opts.cost ?? null,
      metadata: opts.metadata ?? null,
    })

    if (error) {
      console.error('[Usage Log Error]', {
        type: 'insert_failed',
        service,
        eventType,
        timestamp: new Date().toISOString(),
        error: error.message,
      })
    }
  } catch (err) {
    console.error('[Usage Log Error]', {
      type: 'unexpected',
      service,
      eventType,
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/app-settings/usage.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/app-settings/usage.ts tests/unit/lib/app-settings/usage.test.ts
git commit -m "feat: add usage logging helper for billable API calls"
```

---

### Task 12: Wire usage logging into existing code

**Files:**

- Modify: `lib/unified-audit/ai-runner.ts` — add `logUsage()` after Claude API calls
- Modify: `lib/unified-audit/psi-runner.ts` — add `logUsage()` after PSI fetches
- Modify: `lib/reports/summary-generator.ts` — add `logUsage()` after Claude API calls

**Step 1: Add logging to AI runner**

In `lib/unified-audit/ai-runner.ts`, after each successful Claude API call, add:

```typescript
import { logUsage } from '@/lib/app-settings/usage'

// After the AI analysis call returns with usage data:
await logUsage('anthropic', 'ai_analysis', {
  organizationId: audit.organization_id,
  tokensInput: result.usage?.promptTokens,
  tokensOutput: result.usage?.completionTokens,
  cost: estimatedCost,
  metadata: { auditId: audit.id, pageUrl, model: 'claude-sonnet-4-5-20250514' },
})
```

Find the exact location where token counts are available after the AI call and insert the `logUsage` call there.

**Step 2: Add logging to PSI runner**

In `lib/unified-audit/psi-runner.ts`, after each successful PSI fetch:

```typescript
import { logUsage } from '@/lib/app-settings/usage'

// After successful PSI fetch:
await logUsage('pagespeed', 'psi_fetch', {
  organizationId: audit.organization_id,
  metadata: { auditId: audit.id, pageUrl },
})
```

**Step 3: Add logging to summary generator**

In `lib/reports/summary-generator.ts`, after each successful Claude call:

```typescript
import { logUsage } from '@/lib/app-settings/usage'

// After summary generation:
await logUsage('anthropic', 'summary_generation', {
  organizationId,
  tokensInput: result.usage?.promptTokens,
  tokensOutput: result.usage?.completionTokens,
  metadata: { auditId },
})
```

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors

**Step 5: Commit**

```bash
git add lib/unified-audit/ai-runner.ts lib/unified-audit/psi-runner.ts lib/reports/summary-generator.ts
git commit -m "feat: wire usage logging into AI runner, PSI runner, and summary generator"
```

---

### Task 13: System tab — server actions

**Files:**

- Create: `app/(authenticated)/app-settings/system/actions.ts`

**Step 1: Implement server actions**

Two actions:

- `getSystemHealth()` — returns health status per service:
  - For API keys (anthropic, resend, pagespeed): check if configured in `app_settings` or env var, get last `usage_logs` entry for that service
  - For crons: query `audits` for last cron-triggered audit (`created_at` of most recent), query `platform_connections` for most recent `last_sync_at`, check `app_settings` for last cleanup timestamp
  - Returns `{ service, status: 'healthy'|'unconfigured'|'inactive', lastActivity: string|null }[]`
  - A service is "inactive" if it's configured but has no `usage_logs` entries in the last 7 days

- `getUsageSummary(period: '7d' | '30d' | 'month')` — aggregates `usage_logs`:
  - Summary totals per service: total tokens, estimated cost, call count
  - Per-org breakdown: same metrics grouped by `organization_id`
  - Null `organization_id` grouped as "Quick Audit"
  - Returns `{ totals: ServiceTotal[], byOrganization: OrgUsage[] }`

Auth: require internal user (view-only, no admin needed for reads).

**Step 2: Commit**

```bash
git add "app/(authenticated)/app-settings/system/actions.ts"
git commit -m "feat: add system health and usage summary server actions"
```

---

### Task 14: System tab — UI page

**Files:**

- Modify: `app/(authenticated)/app-settings/system/page.tsx` (replace placeholder)
- Create: `app/(authenticated)/app-settings/system/client.tsx`

**Step 1: Create the server page**

RSC that fetches system health and usage summary, passes to client component.

**Step 2: Create the client component**

Two sections:

**Health section** — grid of status cards (2 or 3 columns). Each card shows:

- Service name + icon
- Status dot (green/yellow/gray)
- Last activity timestamp or "No activity"

**Usage section** — below health cards:

- Period selector (tabs or dropdown: "This month", "Last 30 days", "Last 7 days")
- Summary cards row: one per service with total count + cost
- Per-org breakdown table: Organization | AI Tokens | Est. Cost | Emails | PSI Calls
- Null org rows shown as "(Quick Audit)"

Use Shadcn `Card`, `Table`, `Tabs`, `Badge` components.

**Step 3: Verify page renders**

Run: `npm run dev`

- Navigate to `/app-settings/system`
- Health cards should show status for each service
- Usage section shows empty state initially (no logs yet)

**Step 4: Commit**

```bash
git add "app/(authenticated)/app-settings/system/"
git commit -m "feat: add system tab with health dashboard and usage breakdown"
```

---

## Phase 5: Finalize

### Task 15: Lint, format, test, build

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors (warnings OK)

**Step 2: Run format**

Run: `npm run format`

**Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass

**Step 4: Run build**

Run: `npm run build`
Expected: Clean build

**Step 5: Fix any issues and commit**

```bash
git add -A
git commit -m "chore: lint, format, and fix build issues"
```

---

### Task 16: Push migration to production

**Step 1: Push migration**

Run: `supabase db push`
Expected: Migration applied, tables created, backfill complete

**Step 2: Verify backfill**

Verify that existing internal users were backfilled into `internal_employees`:

```sql
SELECT ie.user_id, u.first_name, u.last_name
FROM internal_employees ie
JOIN users u ON u.id = ie.user_id;
```

**Step 3: Commit any final changes**

```bash
git add -A
git commit -m "chore: finalize app settings feature"
```
