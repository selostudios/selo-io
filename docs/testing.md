# Testing Guide

## Overview

This project uses a comprehensive testing strategy:
- **Unit Tests**: Vitest + Testing Library for components and utilities
- **Integration Tests**: Vitest + Local Supabase for server actions and RLS
- **E2E Tests**: Playwright for critical user journeys

## Running Tests

```bash
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
```

## Local Supabase Setup

```bash
# First time setup
supabase init
supabase start

# Run migrations
supabase db reset

# Seed test data for E2E
npm run test:seed
```

## Writing Tests

### Unit Tests

Location: `tests/unit/`

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Integration Tests

Location: `tests/integration/`

Use real database with `testDb` helper:

```typescript
import { testDb, createTestUser } from '../helpers/db'

it('creates user with correct role', async () => {
  const user = await createTestUser('test@example.com', 'password')
  expect(user.email).toBe('test@example.com')
})
```

### E2E Tests

Location: `tests/e2e/`

```typescript
import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})
```

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
