# App Settings Design

**Goal:** Add a Selo-level settings area for managing internal employees, app-level integrations (API keys + email config), and system observability, accessible only to internal users.

**Architecture:** New parent sidebar section with three tabs (Team, Integrations, System). Three new tables (`internal_employees`, `app_settings`, `usage_logs`). Reuses existing invite flow for onboarding internal employees. Existing `crypto.ts` for credential encryption. Dual-write pattern keeps `users.is_internal` in sync.

---

## Data Model

### `internal_employees` table

```sql
CREATE TABLE internal_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_internal_employees_public_user
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);
```

- Source of truth for who is an internal (Selo) employee
- Backfilled from `users WHERE is_internal = true` on first migration
- Dual-write: inserting/deleting from `internal_employees` also sets `users.is_internal` accordingly
- `is_internal_user()` DB function and RLS policies remain unchanged (they still read `users.is_internal`)
- FK to both `auth.users` (cascade delete) and `public.users` (PostgREST join inference)

### `app_settings` table

```sql
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  credentials JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- Stores encrypted app-level API credentials
- Keys: `anthropic`, `resend`, `pagespeed`, `cron_secret`
- Credentials encrypted with existing `crypto.ts` (AES-256-GCM)
- Credential shapes:
  - `anthropic` → `{ api_key: "sk-ant-..." }`
  - `resend` → `{ api_key: "re_..." }`
  - `pagespeed` → `{ api_key: "AIza..." }`
  - `cron_secret` → `{ secret: "..." }`

### `usage_logs` table

```sql
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,          -- 'anthropic', 'resend', 'pagespeed'
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,       -- 'ai_analysis', 'email_sent', 'psi_fetch'
  tokens_input INTEGER,           -- Anthropic input tokens (null for non-AI)
  tokens_output INTEGER,          -- Anthropic output tokens (null for non-AI)
  cost NUMERIC(10,6),             -- Estimated cost in USD (null if unknown)
  metadata JSONB,                 -- Service-specific details (model, email recipient, URL analyzed, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_service_created ON usage_logs (service, created_at DESC);
CREATE INDEX idx_usage_logs_org ON usage_logs (organization_id, created_at DESC);
```

- Logs every billable API call with org attribution
- `organization_id` nullable — some calls (e.g. quick audit) have no org
- Aggregated for the System tab: totals per service, per-org breakdown
- Old records can be pruned by the existing audit-cleanup cron or a new retention policy

### `invites` table changes

- Add new column: `type TEXT NOT NULL DEFAULT 'org_invite'` (values: `org_invite`, `internal_invite`)
- For internal invites: `organization_id` is null, `role` is null
- Acceptance flow branches on `type`:
  - `org_invite` → existing flow (create `team_members` + sync `users`)
  - `internal_invite` → insert `internal_employees`, set `users.is_internal = true`

### RLS Policies

**`internal_employees`:**

- SELECT: internal users can view all rows
- INSERT/UPDATE/DELETE: internal admins only

**`app_settings`:**

- SELECT: internal users (view), with masked credentials in app layer
- INSERT/UPDATE/DELETE: internal admins only
- `SECURITY DEFINER` function `get_app_credential(key)` for service-level reads (AI runner, cron auth, email sender, PSI runner)

**`usage_logs`:**

- SELECT: internal users only
- INSERT: service-level code via service client (bypasses RLS)
- No UPDATE/DELETE via app — cleanup via cron or manual SQL

---

## Navigation

### Parent Sidebar

New section "App Settings" with cog icon. Position: between Organizations and Support.

```
Home           (all users)
Quick Audit    (internal only)
Organizations  (internal only)
App Settings   (internal only)    ← NEW
Support        (internal + external_developer)
```

Visibility: `is_internal` check (same pattern as Organizations).

### Child Sidebar

Three items, no section headers:

- "Team" — Users icon → `/app-settings/team`
- "Integrations" — Plug icon → `/app-settings/integrations`
- "System" — Activity icon → `/app-settings/system`

### Routes

- `/app-settings/team` — manage internal employees
- `/app-settings/integrations` — manage app-level API keys + email config
- `/app-settings/system` — system health + usage/billing

---

## Access Control

| Layer          | Check                                                       |
| -------------- | ----------------------------------------------------------- |
| Parent sidebar | Hidden for non-internal users                               |
| Layout guard   | Redirect non-internal users to `/dashboard`                 |
| Page-level     | Non-admin internal users: view only, controls disabled      |
| Server actions | `withAuth` + `isInternal && role === 'admin'` for mutations |

---

## Team Tab

### UI

Table listing all internal employees (from `internal_employees` joined to `users` and `auth.users`).

**Columns:**

- Name (first + last)
- Email
- Last sign in (from `auth.users.last_sign_in_at`)

**Actions (admin only):**

- **"Invite Employee" button** — enter email, creates an `invites` row with `type = 'internal_invite'`, sends internal invite email
- **"Remove" per row** — confirmation dialog:
  - If user has no `team_members` record: warning that they will be fully locked out
  - Deletes `internal_employees` row
  - Sets `users.is_internal = false`
  - Deletes `auth.users` record (cascades to `users`, `team_members`)
- **Cannot remove yourself**

### Internal Employee Invite Flow

1. Admin clicks "Invite Employee" in App Settings → Team
2. Creates invite: `type = 'internal_invite'`, `organization_id = null`, `role = null`, `email = entered_email`
3. Sends email using new `internal-invite-email.tsx` template ("You've been invited to join the Selo team")
4. Recipient clicks link → `/accept-invite/[id]`
5. Accept-invite page detects `type = 'internal_invite'`:
   - If user doesn't exist: redirects to sign up, then back to accept
   - Shows "You've been invited to join the Selo team" (not org name)
   - On accept:
     - Insert into `internal_employees` with `added_by`
     - Set `users.is_internal = true`
     - Mark invite as accepted
     - Redirect to `/dashboard`

### Email Template: `internal-invite-email.tsx`

- Subject: "You've been invited to join the Selo team"
- Body: "You've been invited to join Selo as an internal team member. Click below to accept."
- CTA button: links to `/accept-invite/[id]`
- Uses same React Email base layout as existing `invite-email.tsx`

---

## Integrations Tab

### UI

Card per provider, stacked vertically.

**Providers:**

- Anthropic (robot icon)
- Resend (mail icon)
- PageSpeed Insights (gauge icon)
- Cron Secret (key icon)

**Card layout:**

```
┌─────────────────────────────────────────────────┐
│  🤖 Anthropic                    [Configured]   │
│  sk-ant-•••••abc123                             │
│  Updated 2 hours ago by owain@selo.io           │
│                                                 │
│  [Test Connection]  [Update Key]  [Remove]      │
└─────────────────────────────────────────────────┘
```

**Per card:**

- Provider name + icon
- Status badge: "Configured" (green) / "Not configured" (gray)
- Masked key: last 6 characters only (extracted server-side, full key never sent to client)
- Last updated timestamp + who updated
- Actions (admin only):
  - **Update Key** — dialog with input field, encrypts and upserts to `app_settings`
  - **Test Connection** — server-side health check, returns success/error toast
  - **Remove** — clears credential with confirmation dialog

**Test connection endpoints:**

- Anthropic: `GET https://api.anthropic.com/v1/models`
- Resend: `GET https://api.resend.com/api-keys`
- PageSpeed: `GET pagespeedonline/v5/runPagespeed?url=https://google.com` (minimal check)
- Cron Secret: no test available (just a bearer token)

### Email Configuration Section

Below the API key cards, a separate "Email Configuration" section with a simple form:

- **From Name** — text input (e.g. "Selo")
- **From Email** — text input (e.g. "hello@selo.io")

Stored in `app_settings` with key `email_config`, credentials shape: `{ from_name: "Selo", from_email: "hello@selo.io" }` (not sensitive, but same table for consistency).

The email sender reads from `app_settings` first, falls back to `RESEND_FROM_EMAIL` env var.

### Server Actions

- `getAppSettings()` — fetches all `app_settings` rows, returns masked preview (last 6 chars) per key for credentials, full values for non-sensitive keys like `email_config`. Full keys never sent to client.
- `updateAppSetting(key, value)` — encrypts credentials (for API keys) or stores plaintext (for email config), upserts into `app_settings`, records `updated_by`
- `removeAppSetting(key)` — deletes row with confirmation
- `testAppConnection(key)` — decrypts credential, makes health check API call, returns `{ success, message }`

---

## System Tab

### Health Section

Status cards in a grid, one per service. Each card shows:

- **Service name + icon**
- **Status indicator** — green (healthy), yellow (degraded), red (error), gray (unconfigured)
- **Last activity** — most recent successful event from `usage_logs`

**Services monitored:**

| Service            | Status Check                            | Last Activity Source                                                               |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------------------------- |
| Anthropic API      | Key configured in `app_settings` or env | Last `usage_logs` entry where `service = 'anthropic'`                              |
| Resend (Email)     | Key configured                          | Last `usage_logs` entry where `service = 'resend'`                                 |
| PageSpeed Insights | Key configured                          | Last `usage_logs` entry where `service = 'pagespeed'`                              |
| Weekly Audits Cron | N/A                                     | Last `audits` record created by cron (check `created_by IS NULL` or a cron marker) |
| Daily Metrics Sync | N/A                                     | Most recent `platform_connections.last_sync_at` across all connections             |
| Audit Cleanup Cron | N/A                                     | Last cleanup timestamp (could add to `app_settings` as `last_cleanup_at`)          |

No external API calls on page load — status is derived from existing DB data.

### Usage Section

Below health cards. Current month totals + per-org breakdown.

**Summary cards (top row):**

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Anthropic     │  │ Emails       │  │ PSI Calls    │
│ 1.2M tokens   │  │ 347 sent     │  │ 892 fetches  │
│ ~$4.80        │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Per-org breakdown table:**

| Organization  | AI Tokens | Est. Cost | Emails  | PSI Calls |
| ------------- | --------- | --------- | ------- | --------- |
| Acme Corp     | 450K      | $1.80     | 52      | 340       |
| BigCo         | 380K      | $1.52     | 48      | 280       |
| (Quick Audit) | 120K      | $0.48     | 0       | 92        |
| **Total**     | **1.2M**  | **$4.80** | **347** | **892**   |

Rows where `organization_id IS NULL` grouped as "(Quick Audit)" or "(No org)".

Period selector: current month (default), last 30 days, last 7 days.

### Server Actions

- `getSystemHealth()` — queries `app_settings` for configured status, `usage_logs` for last activity per service, `audits`/`platform_connections` for cron activity
- `getUsageSummary(period)` — aggregates `usage_logs` by service and organization for the selected period

### Usage Logging

New helper: `logUsage(service, eventType, opts?)`:

```typescript
await logUsage('anthropic', 'ai_analysis', {
  organizationId: audit.organization_id,
  tokensInput: result.usage.input_tokens,
  tokensOutput: result.usage.output_tokens,
  cost: estimatedCost,
  metadata: { model: 'claude-sonnet-4-5-20250514', auditId: audit.id },
})
```

Inserted into call sites:

- AI runner → after each Claude API call
- PSI runner → after each PageSpeed fetch
- Email sender → after each Resend send
- Summary generator → after each Claude call

Uses service client to bypass RLS.

---

## Runtime Credential Resolution

New helper: `getAppCredential(key: string): Promise<string | null>`

1. Query `app_settings` using service client (bypasses RLS)
2. Decrypt credentials
3. If not found, fall back to `process.env[ENV_VAR_MAP[key]]`
4. Return the credential value or null

**ENV_VAR_MAP:**

- `anthropic` → `ANTHROPIC_API_KEY`
- `resend` → `RESEND_API_KEY`
- `pagespeed` → `PAGESPEED_API_KEY`
- `cron_secret` → `CRON_SECRET`

**Used by:**

- AI runner (`lib/unified-audit/ai-runner.ts`)
- PSI runner (`lib/unified-audit/psi-runner.ts`)
- Email sender (Resend client initialization)
- Cron auth middleware (`app/api/cron/*/route.ts`)
- Report summary generator (`lib/reports/summary-generator.ts`)

---

## Migration Path

1. Create `internal_employees`, `app_settings`, and `usage_logs` tables with RLS and indexes
2. Backfill `internal_employees` from `users WHERE is_internal = true`
3. Add `type` column to `invites` table (default `'org_invite'`)
4. No env vars removed — they serve as permanent fallback
5. No existing behavior changes — all current code paths continue working
6. Future: migrate `is_internal_user()` DB function to check `internal_employees` instead of `users.is_internal`

---

## Files to Create/Modify

| File                                                       | Change                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| **Database**                                               |                                                        |
| `supabase/migrations/XXXXXX_app_settings.sql`              | Create tables, RLS, indexes, backfill                  |
| **Navigation**                                             |                                                        |
| `components/navigation/parent-sidebar.tsx`                 | Add App Settings section                               |
| `components/navigation/child-sidebar.tsx`                  | Add app-settings navigation config                     |
| **Layout & Auth**                                          |                                                        |
| `app/(authenticated)/app-settings/layout.tsx`              | Layout with internal user guard                        |
| **Team Tab**                                               |                                                        |
| `app/(authenticated)/app-settings/team/page.tsx`           | Internal employee management page                      |
| `app/(authenticated)/app-settings/team/actions.ts`         | Server actions for employee CRUD + invite              |
| `emails/internal-invite-email.tsx`                         | New email template for internal invites                |
| `app/accept-invite/[id]/page.tsx`                          | Branch UI on invite type                               |
| `app/accept-invite/[id]/actions.ts`                        | Branch acceptance on invite type                       |
| `app/auth/callback/route.ts`                               | Handle internal invite acceptance in OAuth flow        |
| **Integrations Tab**                                       |                                                        |
| `app/(authenticated)/app-settings/integrations/page.tsx`   | API keys + email config page                           |
| `app/(authenticated)/app-settings/integrations/actions.ts` | Server actions for app settings CRUD + test connection |
| `lib/app-settings/credentials.ts`                          | `getAppCredential()` helper with env fallback          |
| **System Tab**                                             |                                                        |
| `app/(authenticated)/app-settings/system/page.tsx`         | Health + usage dashboard                               |
| `app/(authenticated)/app-settings/system/actions.ts`       | Server actions for health + usage queries              |
| `lib/app-settings/usage.ts`                                | `logUsage()` helper for recording API calls            |
| **Usage Logging Integration**                              |                                                        |
| `lib/unified-audit/ai-runner.ts`                           | Add `logUsage()` calls after Claude API calls          |
| `lib/unified-audit/psi-runner.ts`                          | Add `logUsage()` calls after PSI fetches               |
| `lib/reports/summary-generator.ts`                         | Add `logUsage()` calls after Claude API calls          |
| Email sender initialization                                | Add `logUsage()` calls after Resend sends              |
