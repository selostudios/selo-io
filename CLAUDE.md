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

### Multi-Tenant Data Model

Organizations own all data (campaigns, platform connections, team members). RLS policies enforce data isolation at the database level. User roles: `admin`, `team_member`, `client_viewer`.

### Key Patterns

**Server Components by Default**: Pages are RSC. Use `'use client'` only when needed for interactivity.

**Server Actions**: Mutations use `'use server'` in `actions.ts` files colocated with pages. Call `revalidatePath()` after mutations.

**Platform Integration**: Adapter pattern normalizes external platform data. See `lib/platforms/linkedin/` for reference implementation.

**Supabase Clients**:

- `lib/supabase/server.ts` - Server-side (RSC, server actions)
- `lib/supabase/client.ts` - Browser-side

### Directory Structure

```
app/                    # Next.js App Router pages
  auth/                 # OAuth callback, sign-out
  login/, onboarding/   # Auth flows
  dashboard/            # Main app (campaigns list/detail)
  settings/             # Team, organization, integrations
  accept-invite/[id]/   # Team invite acceptance
components/             # React components (ui/, dashboard/, etc.)
lib/                    # Utilities, clients, platform integrations
emails/                 # React Email templates
tests/                  # Unit, integration, E2E tests
  helpers/              # Test utilities (db.ts, mocks.ts, seed.ts)
docs/plans/             # Implementation plans and design docs
```

### Testing Strategy

- **Unit (60%)**: `tests/unit/` - Components, utilities with Vitest + Testing Library
- **Integration (30%)**: `tests/integration/` - Server actions, RLS policies with real Supabase
- **E2E (10%)**: `tests/e2e/` - Critical user journeys with Playwright

Integration and E2E tests require local Supabase running via Docker.

### Error Logging Convention

```typescript
console.error('[Context Error]', { type: 'error_type', timestamp: new Date().toISOString() })
```
