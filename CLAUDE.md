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

Organizations own all data (campaigns, platform connections, team members). RLS policies enforce data isolation at the database level.

**Membership model:** The `team_members` join table is the **primary source of truth** for organization membership and roles. Each row links a user to an organization with a role. Auth queries read org/role exclusively from `team_members` via PostgREST joins (e.g., `users.select('id, is_internal, team_members(organization_id, role)')`).

> **Note:** The legacy `users.organization_id` and `users.role` columns still exist and are written to in parallel because ~30 RLS policies across 15+ tables still reference them. These columns will be dropped in a future migration after RLS policies are rewritten to use `team_members`.

**User roles:** `admin`, `developer`, `team_member`, `client_viewer`, `external_developer` (defined as `user_role` enum in the database and `UserRole` in `lib/enums.ts`).

### Key Patterns

**Server Components by Default**: Pages are RSC. Use `'use client'` only when needed for interactivity.

**Server Actions**: Mutations use `'use server'` in `actions.ts` files colocated with features. Call `revalidatePath()` after mutations.

**Supabase Clients**:

- `lib/supabase/server.ts` - Server-side (RSC, server actions)
- `lib/supabase/client.ts` - Browser-side

**Auth**: Always use `supabase.auth.getUser()` to authenticate requests. Never use `getSession()` — it reads directly from cookies without server-side verification, which is insecure.

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

### Unified Audit System

The unified audit system (`lib/unified-audit/`) replaces the previous separate SEO, Page Speed, and AIO audit systems with a single comprehensive audit. It produces three scores: **SEO**, **Performance**, and **AI Readiness**, combined into an overall score.

**Database tables:**

- `audits` — Main audit record with scores, status, crawl metadata
- `audit_pages` — Crawled pages with title, meta description, status code
- `audit_checks` — Individual check results per page (or site-wide)
- `audit_crawl_queue` — Batch crawling queue for large sites
- `audit_ai_analyses` — Claude AI analysis results per page

**Audit pipeline:** `Pending → Crawling → [AwaitingConfirmation] → Checking → Analyzing → Completed`

1. **Crawling** (`runner.ts` / `batch-crawler.ts`): Crawls pages, stores in `audit_pages`. Supports standard and exhaustive crawl modes. Batch crawler self-continues via `POST /api/unified-audit/{id}/continue` to handle Vercel's timeout limits.
2. **Checking** (`runner.ts`): Runs all check definitions against crawled pages, stores results in `audit_checks`.
3. **Analyzing** (`psi-runner.ts` + `ai-runner.ts`): Fetches PageSpeed Insights data and runs Claude AI analysis on top pages. Results feed into a 40/60 blend scoring model.
4. **Scoring** (`scoring.ts`): Calculates SEO, Performance, and AI Readiness scores from check results.

**Check categories** (10 categories, ~60 checks in `lib/unified-audit/checks/`):

| Category          | Directory            | Examples                                                                              |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------- |
| Crawlability      | `crawlability/`      | robots.txt, sitemap, HTTPS redirect, noindex, AI crawler access, llms.txt             |
| Meta Content      | `meta-content/`      | title, meta description, canonical, OG tags, favicon, duplicates                      |
| Content Structure | `content-structure/` | H1, heading hierarchy, FAQ sections, comparison tables, step-by-step guides           |
| Content Quality   | `content-quality/`   | readability, content depth, freshness, paragraph structure                            |
| Links             | `links/`             | broken links, internal linking, redirect chains, URL structure                        |
| Media             | `media/`             | alt text, oversized images, media richness                                            |
| Structured Data   | `structured-data/`   | schema markup, organization schema, speakable schema, validation                      |
| Security          | `security/`          | SSL certificate, mixed content                                                        |
| Performance       | `performance/`       | Core Web Vitals, Lighthouse scores, mobile-friendly, response time                    |
| AI Visibility     | `ai-visibility/`     | brand mentions, citability, content accessibility, HTML structure, platform readiness |

**Check types:**

- **Site-wide checks** (`isSiteWide: true`) — Run once per audit (robots.txt, sitemap, duplicate titles, etc.)
- **Page-specific checks** — Run on each crawled page (title, meta, H1, images, etc.)

**Implementation:**

- Checks defined in `lib/unified-audit/checks/{category}/{check-name}.ts`
- All follow `AuditCheckDefinition` interface with priority (`critical`/`recommended`/`optional`)
- Each check specifies which `ScoreDimension`(s) it feeds via `feedsScores`
- Results include actionable fix guidance and learn-more URLs
- Checks can be dismissed per organization via `dismissed_checks` table

> **Legacy audit systems** (`lib/audit/`, `lib/performance/`) still exist in the codebase but are deprecated. The former `lib/aio/` system has been fully migrated into the unified audit's modular architecture. All new audit work should use the unified system.

### Directory Structure

```
app/                    # Next.js App Router pages
  (authenticated)/      # Auth-required routes (dashboard, settings, audits)
    seo/audit/          # Unified audit pages
    settings/           # Team, organization, integrations
    dashboard/          # Campaigns, metrics
  api/
    cron/               # Scheduled job endpoints
    unified-audit/      # Unified audit API routes
  auth/                 # OAuth callback, sign-out
  onboarding/           # New user onboarding flow
  accept-invite/        # Team invite acceptance
  s/[token]/            # Public shared resource pages
components/
  audit/                # Shared audit components (unified-check-list, etc.)
  dashboard/            # MetricCard, platform sections, IntegrationsPanel
  navigation/           # Sidebar, navigation shell
  ui/                   # Shadcn components
lib/
  actions/              # Shared server action utilities (with-auth.ts)
  auth/                 # Cached auth helpers (cached.ts, resolve-org.ts)
  unified-audit/        # Unified audit system (runner, crawler, checks, scoring)
  platforms/            # LinkedIn, HubSpot, GA integrations
  metrics/              # Caching, trend calculations, time series
  oauth/providers/      # OAuth provider implementations
  permissions.ts        # RBAC permission system
  enums.ts              # Centralized TypeScript enums
  supabase/             # Database clients (server.ts, client.ts)
emails/                 # React Email templates
scripts/                # CLI utilities (add-user, reset-password)
tests/
  unit/                 # Vitest + Testing Library
  integration/          # Server actions, RLS with real Supabase
  e2e/                  # Playwright user journeys
  helpers/              # Test utilities (db.ts, mocks.ts, seed.ts)
supabase/
  migrations/           # SQL migrations (applied via supabase db push)
```

### Navigation Architecture

Two-tier sidebar: **ParentSidebar** (64px icon strip) + **ChildSidebar** (304px menu, collapsible). Config-driven via `components/navigation/`.

**Parent sections:**

- **Home** (all users) — Marketing (Dashboard, Campaigns), Audits (Unified Audit), Reports, Settings
- **Quick Audit** (internal only) — One-time URL audits without an organization
- **Organizations** (internal only) — Manage all organizations
- **Support** (internal + external_developer with feedback permission)

**Route-to-section mapping:** `/seo/*` and `/dashboard/*` routes map to the Home section. `/quick-audit` maps to Quick Audit. Section is derived from pathname in `navigation-shell.tsx`.

**Org parameter (`?org=`):** Preserved across navigation for `/seo/*`, `/settings/*`, and `/dashboard/*` routes.

### Quick Audit (One-Time URL Audits)

**Business purpose:** Selo employees use Quick Audit to run audits on prospective clients' websites _before_ converting them to an organization. This lets them understand what a business needs and present findings as a sales tool. Once the prospect sees value, they become an organization in the system.

**How it works:**

- `/quick-audit` page with URL input for running a unified audit
- Calls unified audit API endpoints with `organizationId: null`
- All audit tables have nullable `organization_id` + `created_by` for ownership
- RLS policies allow access via `(organization_id IS NULL AND created_by = auth.uid())`
- Action-layer access checks must also handle one-time audits (check `created_by` when `organization_id` is null)

### Testing Strategy

- **Unit (60%)**: Components, utilities with Vitest + Testing Library
- **Integration (30%)**: Server actions, RLS policies with local Supabase
- **E2E (10%)**: Critical user journeys with Playwright

Integration and E2E tests require local Supabase running via Docker.

#### Test Philosophy

We optimize for **confidence in correctness**, not test count or coverage percentage. A small number of well-written tests that catch real bugs is infinitely more valuable than hundreds of tests that verify trivia.

##### What to test

**Tests must validate application behavior, not framework or language features.** Every test should exercise _our_ code and verify a meaningful outcome that maps to something a user or developer would care about.

**DO write tests that:**

- Verify business logic produces correct results given specific inputs (e.g., "score calculation returns 73 for a site with 4 critical failures")
- Confirm check implementations detect the right issues in real HTML
- Validate that components render the correct UI based on application state
- Test that server actions enforce auth, return correct data, and handle edge cases
- Verify integration between modules (e.g., "runner triggers scoring after all checks complete")
- Test error paths and boundary conditions that could cause silent data loss

**Do NOT write tests that:**

- Assert enum values equal their string literals (`expect(Status.Pending).toBe('pending')`)
- Verify TypeScript interfaces compile or have certain properties
- Test that a framework API works as documented (e.g., testing that `useState` updates state)
- Assert trivial type coercions or constant values
- Duplicate what the type system already guarantees
- Test getters, setters, or simple pass-through functions with no logic

**Rule of thumb:** If deleting the test wouldn't reduce confidence in the application working correctly, the test has no value. Every test should be able to catch a real bug.

##### How to name tests

Test descriptions should describe **intent and expected behavior from the user's perspective**, not implementation details. A good test name answers: "What should happen, and under what conditions?"

```typescript
// BAD — describes implementation
'calls calculateTrendFromDb with linkedin_impressions metric type'
'sets state to loading when fetch starts'
'renders a div with className metrics-grid'

// GOOD — describes intent and behavior
'returns zero trend when no historical data exists'
'shows loading indicator while metrics are being fetched'
'displays all five LinkedIn metrics in a responsive grid'
```

**The test name should still make sense if the implementation changes entirely.** If you rename a function and your test name breaks, the name was coupled to implementation. Test names should survive refactors.

For `describe` blocks, name them after the unit being tested (function, component, feature). For `it`/`test` blocks, name them after the behavior:

```typescript
describe('calculateTrendFromDb', () => {
  test('sums daily values across the selected period', () => { ... })
  test('returns null change when previous period has no data', () => { ... })
  test('handles cumulative metrics by using latest value instead of sum', () => { ... })
})
```

##### Test structure

- **Arrange-Act-Assert**: Set up inputs, call the function, verify the output. Keep each test focused on one behavior.
- **No test interdependence**: Tests must not depend on execution order or shared mutable state.
- **Minimal mocking**: Prefer real implementations. Only mock external boundaries (APIs, databases in unit tests). Never mock the module under test.
- **Realistic inputs**: Use data that resembles production. Don't test with `"foo"` and `"bar"` when the function processes HTML documents or metric arrays.

#### E2E Testing Conventions

**Always add `data-testid` attributes** to components that will be targeted in E2E tests:

```typescript
// In component:
<h1 data-testid="reports-page-title">Report History</h1>
<Button data-testid="new-report-button">New Report</Button>
<Card data-testid="reports-empty-state">...</Card>

// In test:
await expect(page.locator('[data-testid="reports-page-title"]')).toBeVisible()
await page.locator('[data-testid="new-report-button"]').click()
```

**Naming convention**: Use kebab-case with descriptive names like `{feature}-{element}-{state}`:

- `reports-page-title` - Page title
- `new-report-button` - Action button
- `reports-empty-state` - Empty state container
- `seo-audit-card` - Selection card
- `validate-selection-button` - Form action

**Why**: Data-testid attributes are more reliable than text selectors (which can match multiple elements) or CSS classes (which may change with styling). They clearly indicate "this element is used in tests" and survive refactoring.

**Login helpers**: Always use the shared helpers from `tests/e2e/helpers.ts` (`loginAsAdmin`, `loginAsTeamMember`, `loginAsDeveloper`). These navigate to `/` after form submission to resolve the org cookie via the proxy middleware. Inline login flows that skip this step cause flaky tests because `page.goto('/settings/team')` relies on the `selo-org` cookie being set for the proxy redirect to `/{orgId}/settings/team`.

### Before Pushing

**MANDATORY: A task is not done until all checks pass.** Every push must be preceded by the full verification suite. Do not push code that fails any check. Do not skip checks to save time. Quality over speed, always.

```bash
npm run lint && npm run test:unit && npm run build
```

**The checklist:**

1. **Format** — If `prettier --check` fails, fix with `npx prettier --write <file>` and re-run lint.
2. **Lint** — All ESLint rules must pass. Do not disable rules to work around failures.
3. **Unit tests** — All tests must pass. If a test fails, investigate and fix the root cause. Do not skip or `.only()` tests to get a green run.
4. **Build** — The production build must succeed. TypeScript errors, missing imports, and type mismatches are all blockers.
5. **Review your diff** — Before committing, read `git diff` to verify you haven't introduced unintended changes, debug artifacts (`console.log`), or leftover code.

**If any check fails, stop and fix it before proceeding.** Do not push with the intention of "fixing it in the next commit." The main branch must always be in a working state.

**After pushing:** Confirm CI passes. If CI fails on something that passed locally (e.g., E2E tests), investigate and fix in a follow-up commit.

### Permissions & Access Control

The application uses a comprehensive role-based access control (RBAC) system defined in `lib/permissions.ts`. All permission checks should use this centralized service rather than inline role comparisons.

#### User Roles

- **`admin`** - Full administrative access to organization
- **`developer`** - Internal Selo employee with support/debugging access
- **`team_member`** - Standard team member with campaign management
- **`client_viewer`** - Read-only client access
- **`external_developer`** - External agency partner with audit access (org-scoped only)

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
- `canViewDashboard(role)` - Dashboard visibility (false for external_developer)
- `canViewCampaigns(role)` - Campaign visibility (admin, team_member only)

#### Role-Based Access Matrix

| Feature                   | Admin                | Developer              | Team Member          | Client Viewer         | External Developer      |
| ------------------------- | -------------------- | ---------------------- | -------------------- | --------------------- | ----------------------- |
| **Dashboard**             | ✓ Full Access        | ✗ No Access            | ✓ Full Access        | ✓ Limited View        | ✗ No Access             |
| **Campaigns**             | ✓ Create/Edit/Delete | ✗ No Access            | ✓ Create/Edit/Delete | ✗ View Only (via RLS) | ✗ No Access             |
| **Organization Settings** | ✓ Full Management    | ✓ View/Update          | ✗ No Access          | ✗ No Access           | ✗ No Access             |
| **Team Management**       | ✓ View + Invite      | ✓ View Only            | ✓ View Only          | ✓ View Only           | ✓ View Only             |
| **Platform Integrations** | ✓ Connect/Disconnect | ✗ No Access            | ✗ No Access          | ✗ No Access           | ✗ No Access             |
| **Support/Feedback**      | ✓ Manage Tickets     | ✓ Manage Tickets       | ✗ No Access          | ✗ No Access           | ✓ View Only             |
| **Unified Audits**        | ✓ Create/View/Delete | ✓ View/Delete All Orgs | ✓ View Only          | ✓ View Only           | ✓ Create/View (own org) |
| **Combined Reports**      | ✓ View               | ✓ View All Orgs        | ✓ View               | ✓ View                | ✓ View (own org)        |

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

> ⚠️ **When adding new roles, permissions, or features:** Update the Role-Based Access Matrix in `CLAUDE.md` to keep documentation accurate for team onboarding.

### Error Logging Convention

```typescript
console.error('[Context Error]', { type: 'error_type', timestamp: new Date().toISOString() })
```

### Security Utilities

**Redirect validation** (`lib/security/redirect.ts`): All user-controlled redirect paths must go through `sanitizeRedirectPath()` to prevent open redirect attacks. Never use raw URL params in `redirect()` or `NextResponse.redirect()`.

**File upload validation** (`lib/security/file-validation.ts`): Always validate file uploads by magic bytes using `validateFileSignature()`, not by client-reported MIME type or file extension. SVG uploads are disallowed (XSS vector).

**Rate limiting** (`lib/rate-limit.ts`): Reusable rate limiter with pre-configured instances for login, sign-up, OAuth, and general API use. Apply via `limiter.check(ip)` before processing requests.

> **Rate Limiting Upgrade:** The current implementation uses in-memory storage which only persists within warm serverless instances. This provides partial protection but is not production-grade. **Before launch or when abuse is observed**, upgrade to a Redis-backed solution (Upstash with `@upstash/ratelimit` is the recommended drop-in). The `lib/rate-limit.ts` interface is designed so only the storage backend needs to change — all call sites remain the same.

**Security headers**: Configured in `next.config.ts` `headers()`. Includes X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.

### LinkedIn OAuth Notes

- App must be approved for "Marketing Developer Platform" product
- Account selector is shown when a user manages multiple organizations; single-account connections auto-save
