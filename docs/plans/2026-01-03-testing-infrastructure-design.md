# Testing Infrastructure Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up comprehensive testing infrastructure covering unit tests, integration tests, and E2E tests for authentication, onboarding, settings, campaigns, and database RLS policies.

**Architecture:** Testing pyramid approach with Vitest for unit/integration tests, Playwright for E2E tests, and local Supabase for database testing.

**Tech Stack:** Vitest, Playwright, Testing Library, local Supabase, GitHub Actions

---

## Testing Architecture

### Testing Pyramid

- **Unit Tests (60%)** - Component rendering, utilities, validation
- **Integration Tests (30%)** - Server actions, database operations, RLS policies
- **E2E Tests (10%)** - Critical user journeys, cross-page flows

### Directory Structure

```
tests/
├── setup.ts              # Global test setup
├── helpers/
│   ├── db.ts            # Database helpers
│   ├── mocks.ts         # Mock utilities
│   └── seed.ts          # Data seeding
├── fixtures/
│   └── index.ts         # Test data fixtures
├── unit/
│   ├── components/      # Component tests
│   └── lib/             # Utility tests
├── integration/
│   ├── actions/         # Server action tests
│   └── rls/             # RLS policy tests
└── e2e/
    ├── auth.spec.ts
    ├── onboarding.spec.ts
    ├── settings.spec.ts
    └── campaigns.spec.ts
```

## Tooling & Configuration

### Dependencies

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.4.0",
    "happy-dom": "^15.0.0",
    "@playwright/test": "^1.48.0",
    "msw": "^2.4.0"
  }
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "vitest watch",
    "test:seed": "tsx tests/helpers/seed.ts",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Integration Testing Strategy

### Local Supabase Setup

- Run Supabase locally via Docker (`supabase start`)
- Real PostgreSQL with RLS policies
- Isolated test environment
- Fast test execution

### Database Helpers

```typescript
// tests/integration/helpers/db.ts
import { createClient } from '@supabase/supabase-js'

export const testDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function createTestUser(email: string, password: string) {
  const { data, error } = await testDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return data.user
}

export async function cleanupTestData(userId?: string) {
  if (userId) {
    await testDb.from('users').delete().eq('id', userId)
  }
}
```

### RLS Policy Testing

Test that row-level security policies work correctly:

- Users can only view users in their organization
- Users cannot update other organizations
- Campaigns are isolated by organization
- Team invitations respect roles

### Server Action Testing

Test server actions with real database operations:

- Organization creation
- Profile updates
- Team invitations
- Campaign management

## E2E Testing Strategy

### Critical User Journeys

**Authentication & Onboarding:**

- Login → Onboarding → Dashboard flow
- Organization creation with industry selection
- Invalid credentials show errors

**Settings & Profile:**

- Admin updates organization settings
- User updates profile (first/last name)
- Admin invites team member
- Navigation between settings tabs

**Campaign Management:**

- Create campaign via dialog
- View campaign list
- Navigate to campaign details
- Empty state handling

### Test Helpers

```typescript
// tests/e2e/helpers.ts
export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'admin@test.com')
  await page.fill('input[name="password"]', 'TestPassword123!')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}
```

## CI/CD with GitHub Actions

### GitHub Actions Workflow

```yaml
name: Tests

on:
  push:
    branches: [main, feature/*]
  pull_request:
    branches: [main]

jobs:
  unit-integration:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      - name: Start Supabase local
        run: supabase start
      - name: Run migrations
        run: supabase db reset
      - name: Run tests
        run: npm run test:unit && npm run test:integration
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Setup Supabase
        uses: supabase/setup-cli@v1
      - name: Start Supabase
        run: supabase start
      - name: Seed test data
        run: npm run test:seed
      - name: Run E2E tests
        run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Vercel Integration

- Enable "Wait for checks to pass before deploying" in Vercel settings
- GitHub Actions runs tests first
- Vercel only deploys if tests pass
- Preview deployments work normally

## Test Data & Fixtures

### Database Seeding

```typescript
// tests/helpers/seed.ts
export async function seedTestData() {
  // Create test users (admin, team member)
  // Create test organization with industry
  // Link users to organization with roles
  // Create test campaigns
}

export async function cleanupTestData() {
  // Clean up in reverse order
  // Delete campaigns, users, organizations
  // Delete auth users
}
```

### Test Fixtures

```typescript
// tests/fixtures/index.ts
export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    firstName: 'Admin',
    lastName: 'User',
  },
  teamMember: {
    email: 'member@test.com',
    password: 'TestPassword123!',
    firstName: 'Team',
    lastName: 'Member',
  },
}
```

## Mocking Strategies

### Mock External Services

```typescript
// tests/helpers/mocks.ts
export function mockResend() {
  vi.mock('@/lib/email/client', () => ({
    resend: {
      emails: {
        send: vi.fn().mockResolvedValue({ id: 'mock-email-id' }),
      },
    },
    FROM_EMAIL: 'noreply@selo.io',
  }))
}
```

### Mock Supabase (unit tests only)

```typescript
export function mockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
      }),
    },
    from: vi.fn().mockReturnValue({
      /* mock queries */
    }),
  }
}
```

## Priority Test Coverage

### Authentication & Onboarding

- Unit: Login form validation, form state
- Integration: Organization creation, user record linking, RLS
- E2E: Complete signup → onboarding → dashboard flow

### Settings & Profile

- Unit: Form validation, change detection, color pickers
- Integration: Admin-only operations, industry FK, team invites
- E2E: Update settings, profile, invite flow

### Campaigns

- Unit: Campaign form, date validation
- Integration: Campaign creation, RLS isolation
- E2E: Create, view, navigate campaigns

### Database & RLS

- Integration: 100% RLS policy coverage
  - Organization isolation
  - User visibility by org
  - Campaign isolation
  - Role-based permissions

## Coverage Targets

- Unit tests: 80%+ coverage
- Integration tests: 100% of server actions
- E2E tests: All critical user paths
- RLS policies: 100% tested

## Local Development Workflow

```bash
# First time setup
supabase init
supabase start

# Run migrations
supabase db reset

# Seed test data
npm run test:seed

# Run tests
npm run test:unit          # Fast unit tests
npm run test:integration   # Integration with DB
npm run test:e2e          # Full E2E tests
npm run test              # All tests

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## Best Practices

1. **Test user behavior, not implementation** - Use semantic queries
2. **Avoid testing library internals** - Don't test React state directly
3. **Mock external dependencies** - Email, external APIs
4. **Keep tests focused** - One assertion per test when possible
5. **Use descriptive test names** - Clear intent and behavior
6. **Isolate tests** - Each test should be independent
7. **Test RLS thoroughly** - Security-critical
8. **Seed realistic data** - Reflect production scenarios
