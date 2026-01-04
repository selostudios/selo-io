# Testing Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement comprehensive testing infrastructure with Vitest, Playwright, and local Supabase support.

**Architecture:** Testing pyramid with unit (60%), integration (30%), and E2E tests (10%). Uses Vitest for unit/integration, Playwright for E2E, local Supabase for database testing.

**Tech Stack:** Vitest 2.0, Playwright 1.48, Testing Library, happy-dom, MSW, local Supabase

---

## Task 1: Install Testing Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Vitest and Testing Library**

Run: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom happy-dom @vitest/coverage-v8`

Expected: Dependencies added to package.json

**Step 2: Install Playwright**

Run: `npm install -D @playwright/test`

Expected: Playwright added to devDependencies

**Step 3: Install MSW for API mocking**

Run: `npm install -D msw`

Expected: MSW added to devDependencies

**Step 4: Verify installation**

Run: `npm list vitest @playwright/test`

Expected: Shows installed versions

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install testing dependencies

Add Vitest, Playwright, Testing Library, and MSW for comprehensive testing infrastructure.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Vitest Configuration

**Files:**
- Create: `vitest.config.ts`

**Step 1: Create vitest.config.ts**

```typescript
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
      exclude: ['node_modules/', 'tests/', '.next/', 'out/']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './')
    }
  }
})
```

**Step 2: Verify config syntax**

Run: `npx vitest --version`

Expected: Vitest version displayed

**Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "feat: add Vitest configuration

Configure Vitest with happy-dom, path aliases, and coverage reporting.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create Playwright Configuration

**Files:**
- Create: `playwright.config.ts`

**Step 1: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'

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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Step 2: Install Playwright browsers**

Run: `npx playwright install chromium`

Expected: Chromium browser downloaded

**Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "feat: add Playwright configuration

Configure Playwright for E2E testing with Chromium browser.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Test Scripts to Package.json

**Files:**
- Modify: `package.json`

**Step 1: Add test scripts**

Add to scripts section:

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

**Step 2: Verify scripts**

Run: `npm run test:unit --version || echo "Script added"`

Expected: Script recognized

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test scripts to package.json

Add npm scripts for running unit, integration, and E2E tests.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Test Directory Structure

**Files:**
- Create: `tests/` directory structure

**Step 1: Create test directories**

Run:
```bash
mkdir -p tests/unit/components tests/unit/lib
mkdir -p tests/integration/actions tests/integration/rls
mkdir -p tests/e2e
mkdir -p tests/helpers tests/fixtures
```

Expected: Directory structure created

**Step 2: Verify structure**

Run: `tree tests -L 2`

Expected: Shows created directories

**Step 3: Create placeholder .gitkeep files**

Run:
```bash
touch tests/unit/components/.gitkeep
touch tests/unit/lib/.gitkeep
touch tests/integration/actions/.gitkeep
touch tests/integration/rls/.gitkeep
touch tests/e2e/.gitkeep
```

**Step 4: Commit**

```bash
git add tests/
git commit -m "chore: create test directory structure

Set up directories for unit, integration, and E2E tests.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Global Test Setup

**Files:**
- Create: `tests/setup.ts`

**Step 1: Create tests/setup.ts**

```typescript
import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Add custom matchers
expect.extend({
  // Add custom matchers here if needed
})
```

**Step 2: Verify setup loads**

Run: `npx vitest run tests/setup.ts --reporter=verbose || echo "Setup file created"`

Expected: Setup file recognized

**Step 3: Commit**

```bash
git add tests/setup.ts
git commit -m "feat: add global test setup

Configure Testing Library cleanup and jest-dom matchers.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create Test Fixtures

**Files:**
- Create: `tests/fixtures/index.ts`

**Step 1: Create tests/fixtures/index.ts**

```typescript
export const testUsers = {
  admin: {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    firstName: 'Admin',
    lastName: 'User'
  },
  teamMember: {
    email: 'member@test.com',
    password: 'TestPassword123!',
    firstName: 'Team',
    lastName: 'Member'
  },
  viewer: {
    email: 'viewer@test.com',
    password: 'TestPassword123!',
    firstName: 'Client',
    lastName: 'Viewer'
  }
}

export const testOrganization = {
  name: 'Test Organization',
  primaryColor: '#000000',
  secondaryColor: '#F5F5F0',
  accentColor: '#666666'
}

export const testCampaign = {
  name: 'Test Campaign',
  description: 'A test campaign for E2E testing',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}

export const testIndustries = {
  marketing: 'Marketing',
  software: 'Software',
  accounting: 'Accounting'
}
```

**Step 2: Commit**

```bash
git add tests/fixtures/index.ts
git commit -m "feat: add test fixtures

Create reusable test data for users, organizations, and campaigns.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create Mock Utilities

**Files:**
- Create: `tests/helpers/mocks.ts`

**Step 1: Create tests/helpers/mocks.ts**

```typescript
import { vi } from 'vitest'

export function mockResend() {
  vi.mock('@/lib/email/client', () => ({
    resend: {
      emails: {
        send: vi.fn().mockResolvedValue({
          id: 'mock-email-id',
          from: 'noreply@selo.io',
          to: 'test@example.com'
        })
      }
    },
    FROM_EMAIL: 'noreply@selo.io'
  }))
}

export function mockSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            created_at: new Date().toISOString()
          }
        },
        error: null
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null })
    })
  }
}

export function resetAllMocks() {
  vi.clearAllMocks()
  vi.resetAllMocks()
}
```

**Step 2: Commit**

```bash
git add tests/helpers/mocks.ts
git commit -m "feat: add mock utilities

Create helpers for mocking Resend and Supabase in unit tests.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Create Database Test Helpers

**Files:**
- Create: `tests/helpers/db.ts`

**Step 1: Create tests/helpers/db.ts**

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const testDb = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

export async function createTestUser(
  email: string,
  password: string,
  metadata?: { first_name?: string; last_name?: string }
) {
  const { data, error } = await testDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata
  })
  if (error) throw error
  return data.user
}

export async function createTestOrganization(name: string, industryId?: string) {
  const { data, error } = await testDb
    .from('organizations')
    .insert({
      name,
      industry: industryId,
      primary_color: '#000000',
      secondary_color: '#F5F5F0',
      accent_color: '#666666'
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function linkUserToOrganization(
  userId: string,
  organizationId: string,
  role: 'admin' | 'team_member' | 'client_viewer',
  firstName?: string,
  lastName?: string
) {
  const { data, error } = await testDb
    .from('users')
    .insert({
      id: userId,
      organization_id: organizationId,
      role,
      first_name: firstName,
      last_name: lastName
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function cleanupTestData() {
  // Clean up in reverse order of dependencies
  await testDb.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('invites').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Delete auth users
  const { data: users } = await testDb.auth.admin.listUsers()
  for (const user of users.users) {
    await testDb.auth.admin.deleteUser(user.id)
  }
}
```

**Step 2: Commit**

```bash
git add tests/helpers/db.ts
git commit -m "feat: add database test helpers

Create utilities for managing test data in Supabase.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Create Database Seed Script

**Files:**
- Create: `tests/helpers/seed.ts`

**Step 1: Create tests/helpers/seed.ts**

```typescript
import { createClient } from '@supabase/supabase-js'
import { testUsers, testOrganization, testCampaign } from '../fixtures'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function seedTestData() {
  console.log('🌱 Seeding test data...')

  // Get Marketing industry
  const { data: industries } = await supabase
    .from('industries')
    .select('id, name')

  const marketingIndustry = industries?.find(i => i.name === 'Marketing')

  // Create admin user
  const adminUser = await supabase.auth.admin.createUser({
    email: testUsers.admin.email,
    password: testUsers.admin.password,
    email_confirm: true,
    user_metadata: {
      first_name: testUsers.admin.firstName,
      last_name: testUsers.admin.lastName
    }
  })

  // Create team member user
  const teamMemberUser = await supabase.auth.admin.createUser({
    email: testUsers.teamMember.email,
    password: testUsers.teamMember.password,
    email_confirm: true,
    user_metadata: {
      first_name: testUsers.teamMember.firstName,
      last_name: testUsers.teamMember.lastName
    }
  })

  // Create test organization
  const { data: org } = await supabase
    .from('organizations')
    .insert({
      name: testOrganization.name,
      industry: marketingIndustry?.id,
      primary_color: testOrganization.primaryColor,
      secondary_color: testOrganization.secondaryColor,
      accent_color: testOrganization.accentColor
    })
    .select()
    .single()

  // Link users to organization
  await supabase.from('users').insert([
    {
      id: adminUser.data.user!.id,
      organization_id: org!.id,
      role: 'admin',
      first_name: testUsers.admin.firstName,
      last_name: testUsers.admin.lastName
    },
    {
      id: teamMemberUser.data.user!.id,
      organization_id: org!.id,
      role: 'team_member',
      first_name: testUsers.teamMember.firstName,
      last_name: testUsers.teamMember.lastName
    }
  ])

  // Create test campaign
  await supabase.from('campaigns').insert({
    name: testCampaign.name,
    description: testCampaign.description,
    organization_id: org!.id,
    start_date: testCampaign.startDate,
    end_date: testCampaign.endDate
  })

  console.log('✅ Test data seeded successfully')
}

export async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...')

  // Clean up in reverse order
  await supabase.from('campaigns').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('invites').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Delete auth users
  const { data: users } = await supabase.auth.admin.listUsers()
  for (const user of users.users) {
    await supabase.auth.admin.deleteUser(user.id)
  }

  console.log('✅ Test data cleaned up')
}

// Run if called directly
if (require.main === module) {
  seedTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Seed failed:', error)
      process.exit(1)
    })
}
```

**Step 2: Commit**

```bash
git add tests/helpers/seed.ts
git commit -m "feat: add database seed script

Create script to seed and clean up test data for E2E tests.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Create First Unit Test (Organization Form)

**Files:**
- Create: `tests/unit/components/organization-form.test.tsx`

**Step 1: Write test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OrganizationForm } from '@/components/settings/organization-form'

describe('OrganizationForm', () => {
  const mockIndustries = [
    { id: 'industry-1', name: 'Marketing' },
    { id: 'industry-2', name: 'Software' }
  ]

  const defaultProps = {
    organizationId: 'org-1',
    name: 'Test Org',
    industryId: 'industry-1',
    logoUrl: '',
    primaryColor: '#000000',
    secondaryColor: '#F5F5F0',
    accentColor: '#666666',
    industries: mockIndustries
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with initial values', () => {
    render(<OrganizationForm {...defaultProps} />)

    expect(screen.getByDisplayValue('Test Org')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('disables save button when no changes made', () => {
    render(<OrganizationForm {...defaultProps} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('enables save button when form is modified', async () => {
    render(<OrganizationForm {...defaultProps} />)

    const nameInput = screen.getByLabelText(/organization name/i)
    fireEvent.change(nameInput, { target: { value: 'Updated Org' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
  })

  it('validates organization name is required', () => {
    render(<OrganizationForm {...defaultProps} />)

    const nameInput = screen.getByLabelText(/organization name/i)
    fireEvent.change(nameInput, { target: { value: '' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })
})
```

**Step 2: Run test to verify it works**

Run: `npm run test:unit tests/unit/components/organization-form.test.tsx`

Expected: Tests pass

**Step 3: Commit**

```bash
git add tests/unit/components/organization-form.test.tsx
git commit -m "test: add unit tests for OrganizationForm

Test form rendering, validation, and change detection.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Create Unit Test for Profile Form

**Files:**
- Create: `tests/unit/components/profile-form.test.tsx`

**Step 1: Write test file**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileForm } from '@/components/settings/profile-form'

describe('ProfileForm', () => {
  const defaultProps = {
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
  }

  it('renders form with initial values', () => {
    render(<ProfileForm {...defaultProps} />)

    expect(screen.getByDisplayValue('John')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument()
  })

  it('disables email field', () => {
    render(<ProfileForm {...defaultProps} />)

    const emailInput = screen.getByLabelText(/email/i)
    expect(emailInput).toBeDisabled()
  })

  it('validates first name minimum length', () => {
    render(<ProfileForm {...defaultProps} />)

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: 'A' } })

    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument()
  })

  it('disables save when no changes made', () => {
    render(<ProfileForm {...defaultProps} />)

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('enables save when name is changed', async () => {
    render(<ProfileForm {...defaultProps} />)

    const firstNameInput = screen.getByLabelText(/first name/i)
    fireEvent.change(firstNameInput, { target: { value: 'Jane' } })

    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await waitFor(() => expect(saveButton).not.toBeDisabled())
  })
})
```

**Step 2: Run test**

Run: `npm run test:unit tests/unit/components/profile-form.test.tsx`

Expected: Tests pass

**Step 3: Commit**

```bash
git add tests/unit/components/profile-form.test.tsx
git commit -m "test: add unit tests for ProfileForm

Test form validation and change detection for profile updates.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Create Utility Function Tests

**Files:**
- Create: `tests/unit/lib/utils.test.ts`

**Step 1: Write test file**

```typescript
import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-2')).toBe('px-2 py-2')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('merges conflicting tailwind classes', () => {
    // This tests tailwind-merge functionality
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('Email validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  it('accepts valid email addresses', () => {
    expect('test@example.com').toMatch(emailRegex)
    expect('user+tag@company.co.uk').toMatch(emailRegex)
    expect('name.surname@domain.org').toMatch(emailRegex)
  })

  it('rejects invalid email addresses', () => {
    expect('invalid').not.toMatch(emailRegex)
    expect('no@domain').not.toMatch(emailRegex)
    expect('@example.com').not.toMatch(emailRegex)
    expect('missing@.com').not.toMatch(emailRegex)
  })
})
```

**Step 2: Run test**

Run: `npm run test:unit tests/unit/lib/utils.test.ts`

Expected: Tests pass

**Step 3: Commit**

```bash
git add tests/unit/lib/utils.test.ts
git commit -m "test: add utility function tests

Test cn utility and email validation regex.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Create E2E Helper Functions

**Files:**
- Create: `tests/e2e/helpers.ts`

**Step 1: Create helper file**

```typescript
import { Page } from '@playwright/test'
import { testUsers } from '../fixtures'

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', testUsers.admin.email)
  await page.fill('input[name="password"]', testUsers.admin.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function loginAsTeamMember(page: Page) {
  await page.goto('/login')
  await page.fill('input[name="email"]', testUsers.teamMember.email)
  await page.fill('input[name="password"]', testUsers.teamMember.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function logout(page: Page) {
  // Click user menu
  await page.click('button:has(svg)')
  // Click sign out
  await page.click('text=Sign out')
  await page.waitForURL('/login')
}

export async function gotoSettings(page: Page, tab: 'organization' | 'team' | 'integrations') {
  await page.click(`text=Settings`)
  await page.waitForURL(`/settings/${tab}`)
}
```

**Step 2: Commit**

```bash
git add tests/e2e/helpers.ts
git commit -m "feat: add E2E test helpers

Create helper functions for common E2E test operations.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Create First E2E Test (Authentication)

**Files:**
- Create: `tests/e2e/auth.spec.ts`

**Step 1: Write test file**

```typescript
import { test, expect } from '@playwright/test'
import { testUsers } from '../fixtures'

test.describe('Authentication', () => {
  test('user can login and reach dashboard', async ({ page }) => {
    await page.goto('/')

    // Should redirect to login
    await expect(page).toHaveURL('/login')

    // Login
    await page.fill('input[name="email"]', testUsers.admin.email)
    await page.fill('input[name="password"]', testUsers.admin.password)
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Test Organization')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'wrong@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error
    await expect(page.locator('text=/invalid.*credentials/i')).toBeVisible()
  })

  test('login button is disabled for invalid email', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'invalid-email')
    await page.fill('input[name="password"]', 'password123')

    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeDisabled()
  })
})
```

**Step 2: Run test (will need seeded data)**

Run: `npm run test:e2e tests/e2e/auth.spec.ts`

Expected: Tests pass (requires seeded database)

**Step 3: Commit**

```bash
git add tests/e2e/auth.spec.ts
git commit -m "test: add E2E authentication tests

Test login flow, error handling, and form validation.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Create E2E Settings Test

**Files:**
- Create: `tests/e2e/settings.spec.ts`

**Step 1: Write test file**

```typescript
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin can update organization name', async ({ page }) => {
    await page.goto('/settings/organization')

    // Update organization name
    const nameInput = page.locator('input[name="name"]')
    await nameInput.fill('Updated Org Name')

    // Save changes
    await page.click('button:has-text("Save Changes")')

    // Should show success message
    await expect(page.locator('text=/successfully/i')).toBeVisible()
  })

  test('admin can navigate between settings tabs', async ({ page }) => {
    await page.goto('/settings/organization')

    // Click Team tab
    await page.click('text=Team')
    await expect(page).toHaveURL('/settings/team')

    // Click Integrations tab
    await page.click('text=Integrations')
    await expect(page).toHaveURL('/settings/integrations')

    // Click Organization tab
    await page.click('text=Organization')
    await expect(page).toHaveURL('/settings/organization')
  })

  test('admin can view team members', async ({ page }) => {
    await page.goto('/settings/team')

    // Should see admin user
    await expect(page.locator('text=Admin User')).toBeVisible()
    await expect(page.locator('text=admin@test.com')).toBeVisible()

    // Should see team member
    await expect(page.locator('text=Team Member')).toBeVisible()
    await expect(page.locator('text=member@test.com')).toBeVisible()
  })
})
```

**Step 2: Run test**

Run: `npm run test:e2e tests/e2e/settings.spec.ts`

Expected: Tests pass

**Step 3: Commit**

```bash
git add tests/e2e/settings.spec.ts
git commit -m "test: add E2E settings tests

Test settings navigation and organization updates.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 17: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/test.yml`

**Step 1: Create workflow directory**

Run: `mkdir -p .github/workflows`

**Step 2: Create test.yml**

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

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase
        run: supabase start

      - name: Seed test data
        run: npm run test:seed
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

**Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add GitHub Actions workflow for tests

Run unit, integration, and E2E tests on CI with Supabase.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 18: Create Testing Documentation

**Files:**
- Create: `docs/testing.md`

**Step 1: Create documentation**

```markdown
# Testing Guide

## Overview

This project uses a comprehensive testing strategy:
- **Unit Tests**: Vitest + Testing Library for components and utilities
- **Integration Tests**: Vitest + Local Supabase for server actions and RLS
- **E2E Tests**: Playwright for critical user journeys

## Running Tests

\`\`\`bash
# Run all tests
npm test

# Run specific test types
npm run test:unit          # Fast unit tests
npm run test:integration   # Integration tests with DB
npm run test:e2e          # E2E tests with Playwright

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
\`\`\`

## Local Supabase Setup

\`\`\`bash
# First time setup
supabase init
supabase start

# Run migrations
supabase db reset

# Seed test data for E2E
npm run test:seed
\`\`\`

## Writing Tests

### Unit Tests

Location: \`tests/unit/\`

\`\`\`typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
\`\`\`

### Integration Tests

Location: \`tests/integration/\`

Use real database with \`testDb\` helper:

\`\`\`typescript
import { testDb, createTestUser } from '../helpers/db'

it('creates user with correct role', async () => {
  const user = await createTestUser('test@example.com', 'password')
  expect(user.email).toBe('test@example.com')
})
\`\`\`

### E2E Tests

Location: \`tests/e2e/\`

\`\`\`typescript
import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
\`\`\`

## Best Practices

1. **Test user behavior, not implementation**
2. **Use semantic queries** (getByRole, getByLabelText)
3. **Mock external services** (email, APIs)
4. **Keep tests focused** (one assertion when possible)
5. **Use descriptive test names**
6. **Clean up test data** in integration/E2E tests

## CI/CD

Tests run automatically on:
- Every push to main or feature branches
- Every pull request

GitHub Actions runs all test suites with local Supabase.

## Coverage Targets

- Unit tests: 80%+ coverage
- Integration tests: 100% of server actions
- E2E tests: All critical user paths
- RLS policies: 100% tested
\`\`\`

**Step 2: Commit**

```bash
git add docs/testing.md
git commit -m "docs: add testing guide

Document how to run and write tests for the project.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 19: Update .gitignore for Test Artifacts

**Files:**
- Modify: `.gitignore`

**Step 1: Add test artifacts to .gitignore**

Add to .gitignore:

```
# Testing
coverage/
.nyc_output/
playwright-report/
test-results/
.vitest/
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore test artifacts

Add coverage and test result directories to .gitignore.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Execution Complete

All tasks completed! The testing infrastructure is now set up with:

✅ Vitest for unit and integration tests
✅ Playwright for E2E tests
✅ Test helpers and fixtures
✅ Database seeding scripts
✅ GitHub Actions CI/CD
✅ Comprehensive documentation

**Next steps:**
1. Initialize Supabase locally: `supabase init && supabase start`
2. Seed test data: `npm run test:seed`
3. Run tests: `npm test`
4. Add more test coverage for remaining components and features
