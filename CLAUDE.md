# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Selo IO is a multi-tenant SaaS marketing performance dashboard that tracks campaigns across LinkedIn, HubSpot, and Google Analytics with AI-powered automated weekly summaries.

## Commands

```bash
# Development
npm run dev              # Start dev server at http://localhost:3000
npm run build            # Production build
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run format:check     # Check formatting (CI)

# Testing
npm test                 # Run ALL tests (unit + integration + e2e)
npm run test:unit        # Vitest unit tests only
npm run test:integration # Integration tests with local Supabase
npm run test:e2e         # Playwright E2E tests
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Generate coverage report

# Run a single test file
npx vitest tests/unit/path/to/file.test.ts
npx vitest tests/unit/path/to/file.test.ts -t "test name"

# Local Supabase (required for integration/E2E tests)
supabase start           # Start local Supabase (Docker required)
supabase db reset        # Run migrations
npm run test:seed        # Seed test data for E2E

# Email
npm run email            # Start React Email preview server

# Utility Scripts
npm run add-user         # CLI: Add test user
npm run reset-password   # CLI: Reset user password

# Metrics Sync (Manual)
npm run sync:metrics              # Sync metrics from all platforms (local dev)
npm run sync:metrics:prod         # Sync metrics from all platforms (production)
npm run backfill:metrics -- 2026-01-24        # Backfill from specific date (local)
npm run backfill:metrics -- 2026-01-24 --prod # Backfill from specific date (prod)
```

## Architecture

### Tech Stack

- **Next.js 16** with App Router and React Server Components
- **Supabase** for auth (JWT in cookies) and PostgreSQL with Row-Level Security
- **Shadcn UI** (New York style) + Tailwind CSS 4 + Radix UI
- **React Email** for templates, **Mailpit** for local email testing, **Resend** for production/staging
- **Vitest** + **Playwright** for testing
- **Recharts** for metric visualizations

### Multi-Tenant Data Model

Organizations own all data (campaigns, platform connections, team members). RLS policies enforce data isolation at the database level. User roles: `admin`, `team_member`, `client_viewer`.

### Key Patterns

**Server Components by Default**: Pages are RSC. Use `'use client'` only when needed for interactivity.

**Server Actions**: Mutations use `'use server'` in `actions.ts` files colocated with features. Call `revalidatePath()` after mutations.

**Supabase Clients**:

- `lib/supabase/server.ts` - Server-side (RSC, server actions)
- `lib/supabase/client.ts` - Browser-side

**Auth Methods** (`getUser()` vs `getSession()`):

- **Use `getUser()`** for sensitive operations (mutations, data writes, protected actions) - validates user with Supabase Auth API
- **Use `getSession()`** for frequently-called read operations (polling endpoints, status checks) - reads from JWT cookie, no API call
- **Rate Limiting**: Supabase Auth API has rate limits. Frequent `getUser()` calls (e.g., polling every 10s) can exhaust limits and cause 429 errors, redirecting users to login
- **Example**: `/api/audit/active` uses `getSession()` since it's polled every 30 seconds

**Empty States**: Always use the `EmptyState` component from `components/ui/empty-state.tsx` when displaying empty results (e.g., no data, no search results, no items in a list). Pass an appropriate icon, title, and optional description. This provides consistent UI with an icon and dashed border.

**Component Design Principles**: Always optimize for reusability and consistency:

- **Extract shared patterns** — When 2+ views share similar UI or logic, extract a generic component with props/render props for customization
- **Composition over duplication** — Build complex UIs by composing smaller, reusable pieces rather than copy-pasting
- **Generic base components** — Create `<ThingBase>` components that handle common logic, with specific variants for each use case
- **Colocate shared components** — Place shared components in `components/{domain}/` (e.g., `components/audit/` for audit-related shared components)
- **Hooks for shared logic** — Extract repeated stateful patterns into custom hooks (e.g., `useServerForm`, `useStreamingProgress`)
- **Type parameters for flexibility** — Use TypeScript generics (`<T>`) to create type-safe reusable components
- **Enums for type safety** — Use TypeScript enums (defined in `lib/enums.ts`) instead of string literals for statuses, types, and categories. This provides IDE autocomplete, compile-time checking, and a single source of truth. Example: `status === CheckStatus.Passed` instead of `status === 'passed'`

### Platform Integration Architecture

Each platform (LinkedIn, HubSpot, Google Analytics) follows the **Adapter Pattern** in `lib/platforms/{platform}/`:

```
Platform API → Client (fetch + token refresh) → Adapter (normalize) → Database
```

- `types.ts` - Credential and metrics interfaces
- `client.ts` - API client with automatic OAuth token refresh
- `adapter.ts` - Normalizes platform data to `campaign_metrics` schema
- `actions.ts` - Server actions for sync operations

**Two sync pathways**:

1. **Service-level** (`syncMetricsFor{Platform}Connection`): Cron jobs with service client (bypasses RLS)
2. **User-triggered** (`sync{Platform}Metrics`): Dashboard refresh with user auth

### Metrics Caching System

Located in `lib/metrics/`:

- **1-hour cache**: `getMetricsFromDb()` checks `platform_connections.last_sync_at`
- **Trend calculation**: `calculateTrendFromDb()` compares current vs previous period
- **Time series**: `buildTimeSeriesArray()` formats data for inline charts
- Returns `null` for trends when insufficient historical data exists

**Data flow**:

```
Dashboard Page (RSC) → IntegrationsPanel (period state)
                    → Platform Sections call getMetrics(period)
                    → Check cache freshness → Return DB data or fetch fresh
                    → MetricCard renders value + trend + inline chart
```

### Cron Jobs

Located in `app/api/cron/`. All cron jobs require `CRON_SECRET` environment variable and are configured in `vercel.json`.

| Job                  | Schedule       | Description                                                                |
| -------------------- | -------------- | -------------------------------------------------------------------------- |
| `weekly-audits`      | Sun 2 AM UTC   | Runs scheduled site audits for organizations with monitoring enabled       |
| `daily-metrics-sync` | Daily 3 AM UTC | Syncs metrics from all active platform connections (LinkedIn, HubSpot, GA) |
| `audit-cleanup`      | Sun 4 AM UTC   | Cleans up old audit data to reduce storage                                 |

**Audit Cleanup Strategy:**

- Keeps checks/pages only for the **most recent audit** per organization
- Previous audits retain scores for trend history but detailed checks are deleted (~90% storage savings)
- One-time audits (no organization) are deleted entirely after 30 days
- Checks/pages from any audit older than 6 months are deleted

### Site Audit Checks

Located in `lib/audit/checks/`. The site audit runs **36 comprehensive checks** across 3 categories:

#### SEO Checks (21 total)

**Critical (9 checks):**

- `missing-meta-description` - Every page needs a meta description
- `missing-title` - Every page needs a title tag
- `missing-h1` - Every page needs an H1 heading
- `missing-sitemap` - XML sitemap existence (checks multiple paths + robots.txt)
- `broken-internal-links` - Detects 4xx/5xx errors with status grouping
- `missing-robots-txt` - Validates robots.txt directives, sitemap reference, crawl rules
- `duplicate-titles` - Finds duplicate page titles across site
- `noindex-on-important-pages` - Detects noindex tags preventing indexation
- `http-to-https-redirect` - Verifies HTTP redirects to HTTPS properly

**Recommended (10 checks):**

- `meta-description-length` - 150-160 characters optimal
- `title-length` - 50-60 characters optimal
- `duplicate-meta-descriptions` - Finds duplicate meta descriptions across site
- `multiple-h1` - Only one H1 per page
- `heading-hierarchy` - Proper H1→H2→H3 structure
- `images-missing-alt` - Alt text for accessibility and SEO
- `missing-canonical` - Canonical URL tag presence
- `canonical-validation` - Validates canonical accessibility, chains, self-referencing
- `redirect-chains` - Detects multi-hop redirects (warns if >2 hops)
- `non-descriptive-url` - URL structure readability

**Optional (2 checks):**

- `thin-content` - Content length analysis
- `oversized-images` - Large image detection

#### AI-Readiness Checks (9 total)

**Critical (5 checks):**

- `missing-llms-txt` - AI crawler configuration file
- `ai-crawlers-blocked` - Ensures AI crawlers not blocked in robots.txt
- `missing-structured-data` - JSON-LD structured data presence
- `slow-page-response` - Page load time under 3s
- `js-rendered-content` - Detects client-side rendering issues

**Recommended (3 checks):**

- `no-faq-content` - FAQ sections for LLM training
- `missing-organization-schema` - Organization schema markup
- `no-recent-updates` - Content freshness (last modified)

**Optional (1 check):**

- `missing-markdown` - Markdown content for AI parsing

#### Technical Checks (6 total)

**Critical (2 checks):**

- `missing-ssl` - HTTPS encryption required
- `invalid-ssl-certificate` - SSL certificate validity

**Recommended (2 checks):**

- `missing-viewport` - Mobile viewport meta tag
- `mixed-content` - HTTP resources on HTTPS pages

**Optional (2 checks):**

- `missing-og-tags` - Open Graph meta tags
- `missing-favicon` - Favicon presence

**Check Types:**

- **Site-wide checks** - Run once per audit (robots.txt, sitemap, duplicate titles, redirect chains, etc.)
- **Page-specific checks** - Run on each crawled page (title, meta, H1, images, etc.)

**Implementation Details:**

- Checks are defined in `lib/audit/checks/{category}/{check-name}.ts`
- All checks follow `AuditCheckDefinition` interface with priority (critical/recommended/optional)
- Results include actionable fix guidance and learn-more URLs
- Checks can be dismissed per organization via `dismissed_checks` table

### Directory Structure

```
app/                    # Next.js App Router pages
  api/cron/             # Scheduled job endpoints
  auth/                 # OAuth callback, sign-out
  dashboard/            # Main app (campaigns, metrics)
  settings/             # Team, organization, integrations
components/
  dashboard/            # MetricCard, platform sections, IntegrationsPanel
  ui/                   # Shadcn components
lib/
  platforms/            # LinkedIn, HubSpot, GA integrations
  metrics/              # Caching, trend calculations, time series
  oauth/providers/      # OAuth provider implementations
  supabase/             # Database clients
emails/                 # React Email templates
tests/
  unit/                 # Vitest + Testing Library
  integration/          # Server actions, RLS with real Supabase
  e2e/                  # Playwright user journeys
  helpers/              # Test utilities (db.ts, mocks.ts, seed.ts)
```

### Testing Strategy

- **Unit (60%)**: Components, utilities with Vitest + Testing Library
- **Integration (30%)**: Server actions, RLS policies with local Supabase
- **E2E (10%)**: Critical user journeys with Playwright

Integration and E2E tests require local Supabase running via Docker.

### Before Pushing

Always run lint and tests before pushing to remote:

```bash
npm run lint && npm run test:unit && npm run build
```

### Permissions & Access Control

The application uses a comprehensive role-based access control (RBAC) system defined in `lib/permissions.ts`. All permission checks should use this centralized service rather than inline role comparisons.

#### User Roles

- **`admin`** - Full administrative access to organization
- **`developer`** - Internal Selo employee with support/debugging access
- **`team_member`** - Standard team member with campaign management
- **`client_viewer`** - Read-only client access

#### Permission Types

```typescript
'org:update' // Manage organization settings
'org:view' // View organization (all roles)
'team:invite' // Invite new team members
'team:view' // View team members (all roles)
'integrations:manage' // Connect/disconnect platforms
'campaigns:create' // Create campaigns
'campaigns:update' // Update campaigns
'campaigns:delete' // Delete campaigns
'feedback:manage' // Manage feedback/support tickets
```

#### Permission Helpers

**Core Functions:**

- `hasPermission(role, permission)` - Check specific permission
- `requirePermission(role, permission)` - Throws error if denied
- `getPermissions(role)` - Returns all permissions for role

**Convenience Helpers:**

- `canManageOrg(role)` - Organization management
- `canManageTeam(role)` - Team invitation/management
- `canManageIntegrations(role)` - Platform connections
- `canManageCampaigns(role)` - Campaign CRUD operations
- `canManageFeedback(role)` - Support ticket access
- `isInternalUser(userRecord)` - Selo employee check
- `canAccessAllAudits(userRecord)` - Cross-org audit access

#### Role-Based Access Matrix

| Feature                   | Admin                | Developer              | Team Member          | Client Viewer         |
| ------------------------- | -------------------- | ---------------------- | -------------------- | --------------------- |
| **Dashboard**             | ✓ Full Access        | ✗ No Access            | ✓ Full Access        | ✓ Limited View        |
| **Campaigns**             | ✓ Create/Edit/Delete | ✗ No Access            | ✓ Create/Edit/Delete | ✗ View Only (via RLS) |
| **Organization Settings** | ✓ Full Management    | ✓ View/Update          | ✗ No Access          | ✗ No Access           |
| **Team Management**       | ✓ View + Invite      | ✓ View Only            | ✓ View Only          | ✓ View Only           |
| **Platform Integrations** | ✓ Connect/Disconnect | ✗ No Access            | ✗ No Access          | ✗ No Access           |
| **Support/Feedback**      | ✓ Manage Tickets     | ✓ Manage Tickets       | ✗ No Access          | ✗ No Access           |
| **Site Audits**           | ✓ Create/View/Delete | ✓ View/Delete All Orgs | ✓ View Only          | ✓ View Only           |
| **Page Speed Audits**     | ✓ Create/View/Delete | ✓ View/Delete All Orgs | ✓ View Only          | ✓ View Only           |
| **AIO Audits**            | ✓ Create/View/Delete | ✓ View/Delete All Orgs | ✓ View Only          | ✓ View Only           |

#### Special Access: Internal Users

Users with `is_internal: true` flag (Selo employees) have elevated privileges:

- Can view and manage any organization (not just their own)
- Can access all audits across organizations
- Can perform support/debugging operations
- Bypasses some organization-scoped restrictions

#### Security Architecture

**Defense in Depth:**

1. **Layout-level guards** - Prevent unauthorized page navigation
2. **Page-level checks** - Secondary verification before rendering
3. **Server action guards** - Protect all mutations at the action level
4. **API route protection** - HTTP endpoints verify permissions
5. **RLS policies** - Database-level security boundary (final enforcement)

**Organization Isolation:**

- All queries include explicit `organization_id` filters
- Prevents cross-organization data access even with valid session
- Internal users can bypass via `canAccessAllAudits()` helper

**Important Notes:**

- RLS policies are the **security boundary** - never rely solely on UI checks
- Permission helpers are for **UX decisions** (showing/hiding UI elements)
- Always import from `@/lib/permissions` - never duplicate permission logic inline
- Use `isInternalUser(userRecord)` instead of `userRecord.is_internal === true`

**Maintenance Reminder:**

> ⚠️ **When adding new roles, permissions, or features:** Update the Role-Based Access Matrix in both `CLAUDE.md` and `README.md` to keep documentation accurate for team onboarding.

### Error Logging Convention

```typescript
console.error('[Context Error]', { type: 'error_type', timestamp: new Date().toISOString() })
```

### LinkedIn OAuth Notes

- App must be approved for "Marketing Developer Platform" product
- Multiple organization selection not yet supported (auto-selects first)
- Production rate limiting recommended before deployment
