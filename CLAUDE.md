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

### Permissions Service

Use `lib/permissions.ts` for all permission-based logic:

- **Role-based permissions**: `hasPermission(role, permission)`, `canManageOrg(role)`, `canManageTeam(role)`, etc.
- **Internal user checks**: `isInternalUser(is_internal)` for Selo employee access
- RLS policies are the security boundary; these helpers are for UX decisions

Always import from `@/lib/permissions` rather than duplicating permission checks inline.

### Error Logging Convention

```typescript
console.error('[Context Error]', { type: 'error_type', timestamp: new Date().toISOString() })
```

### LinkedIn OAuth Notes

- App must be approved for "Marketing Developer Platform" product
- Multiple organization selection not yet supported (auto-selects first)
- Production rate limiting recommended before deployment
